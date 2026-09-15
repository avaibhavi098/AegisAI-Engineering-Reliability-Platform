import { Router, Request, Response, NextFunction } from 'express';
import { db } from './db.js';
import { analyzeIncidentWithAI, analyzeLogsWithAI } from './gemini.js';
import { authenticate, requireRole, hashPassword, generateSalt, verifyPassword, generateSessionToken } from './auth.js';
import { telemetryMonitor } from './monitoring.js';
import {
  validateSignup,
  validateLogin,
  validateServiceCreate,
  validateServiceUpdate,
  validateIncidentCreate,
  validateIncidentUpdate,
  sanitizeText,
  sanitizeErrorMessage,
} from './validation.js';
import type { UserRole } from '../src/types/index.js';

export const apiRouter = Router();

// Request timeout guard (30s standard, 60s for AI endpoints)
apiRouter.use((req: Request, res: Response, next: NextFunction) => {
  const timeoutMs = req.path.includes('/ai/') ? 60000 : 30000;
  req.setTimeout(timeoutMs, () => {
    if (!res.headersSent) {
      res.status(504).json({ error: 'Request timeout: The server took too long to respond.' });
    }
  });
  next();
});

// Track live application API telemetry
apiRouter.use(telemetryMonitor.middleware);

// --- Structured System Health Check Endpoint ---
apiRouter.get('/health', async (req: Request, res: Response) => {
  const healthReport = await telemetryMonitor.getSystemHealthReport();
  const isDown = healthReport.checks.database.status === 'DOWN';
  const statusCode = isDown ? 503 : 200;

  res.status(statusCode).json({
    status: isDown ? 'down' : (healthReport.status === 'down' ? 'degraded' : 'ok'),
    service: 'AegisAI',
    persistence: db.getEngineName(),
    systemStatus: healthReport.systemStatus,
    timestamp: healthReport.timestamp,
    uptimeSeconds: healthReport.uptimeSeconds,
    checks: healthReport.checks,
  });
});

// --- Authentication & Session Management ---
apiRouter.post('/auth/signup', async (req: Request, res: Response) => {
  const validation = validateSignup(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.errors.join('. ') });
  }

  const { name, email, password, role, title } = req.body;
  const cleanEmail = email.toLowerCase().trim();
  const existing = await db.getUserByEmail(cleanEmail);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  try {
    const salt = generateSalt();
    const passwordHash = hashPassword(password, salt);
    const assignedRole: UserRole = role && ['ADMIN', 'ENGINEER', 'VIEWER'].includes(role) ? role : 'ENGINEER';

    const newUser = await db.createUser({
      name: sanitizeText(name, 100),
      email: cleanEmail,
      role: assignedRole,
      title: sanitizeText(title, 100) || 'Site Reliability Engineer',
      passwordHash,
      salt,
    });

    const token = generateSessionToken();
    await db.createSession(newUser.id, token);
    await db.recordUserLogin(newUser.id);

    await db.recordAuditLog({
      userId: newUser.id,
      userName: newUser.name,
      userRole: newUser.role,
      action: 'AUTH_SIGNUP',
      resourceType: 'USER',
      resourceId: newUser.id,
      details: `User account registered with role ${newUser.role}`,
    });

    res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        title: newUser.title,
        avatar: newUser.avatar,
        createdAt: newUser.createdAt,
        lastLoginAt: newUser.lastLoginAt,
      },
      token,
    });
  } catch (err: unknown) {
    const msg = sanitizeErrorMessage(err);
    res.status(400).json({ error: msg });
  }
});

apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  const validation = validateLogin(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.errors.join('. ') });
  }

  const { email, password } = req.body;
  const cleanEmail = email.toLowerCase().trim();
  const user = await db.getUserByEmail(cleanEmail);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  let isValid = verifyPassword(password, user.salt, user.passwordHash);
  if (!isValid && user.isDemo) {
    if (password === 'AegisSec2026!' || (process.env.DEMO_USER_PASSWORD && password === process.env.DEMO_USER_PASSWORD)) {
      isValid = true;
      const newSalt = generateSalt();
      const newHash = hashPassword(password, newSalt);
      await db.updateUserPassword(user.id, newHash, newSalt);
    }
  }
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = generateSessionToken();
  await db.createSession(user.id, token);
  await db.recordUserLogin(user.id);

  await db.recordAuditLog({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: 'AUTH_LOGIN',
    resourceType: 'USER',
    resourceId: user.id,
    details: `User ${user.email} authenticated successfully`,
  });

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      title: user.title,
      avatar: user.avatar,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    },
    token,
  });
});

apiRouter.post('/auth/logout', authenticate, async (req: Request, res: Response) => {
  if (req.token) {
    await db.deleteSession(req.token);
  }
  if (req.user) {
    await db.recordAuditLog({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'AUTH_LOGOUT',
      resourceType: 'USER',
      resourceId: req.user.id,
      details: `User ${req.user.email} signed out`,
    });
  }
  res.json({ success: true, message: 'Session logged out successfully' });
});

apiRouter.get('/auth/me', authenticate, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

apiRouter.get('/auth/users', authenticate, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  const users = await db.getAllUsers();
  res.json({ users });
});

apiRouter.patch('/auth/users/:id/role', authenticate, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  const { role } = req.body;
  if (!role || !['ADMIN', 'ENGINEER', 'VIEWER'].includes(role)) {
    return res.status(400).json({ error: 'Valid role (ADMIN, ENGINEER, VIEWER) is required' });
  }

  const updated = await db.updateUserRole(req.params.id, role as UserRole);
  if (!updated) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (req.user) {
    await db.recordAuditLog({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'USER_ROLE_UPDATED',
      resourceType: 'USER',
      resourceId: updated.id,
      details: `Role for ${updated.name} (${updated.email}) updated to ${role}`,
    });
  }

  res.json({ user: updated });
});

// --- Services Database Operations ---
apiRouter.get('/services', authenticate, async (req: Request, res: Response) => {
  const { page, limit, search, status, tier } = req.query;
  if (page || limit || search || status || tier) {
    const result = await db.getServicesPaginated({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search: typeof search === 'string' ? search : undefined,
      status: typeof status === 'string' ? status : undefined,
      tier: typeof tier === 'string' ? tier : undefined,
    });
    return res.json(result);
  }
  const services = await db.getAllServices();
  res.json({ services, total: services.length, page: 1, limit: services.length, totalPages: 1 });
});

apiRouter.get('/services/:id', authenticate, async (req: Request, res: Response) => {
  const service = await db.getServiceById(req.params.id);
  if (!service) {
    return res.status(404).json({ error: 'Service not found' });
  }
  res.json({ service });
});

apiRouter.post('/services', authenticate, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  const validation = validateServiceCreate(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.errors.join('. ') });
  }

  const { name, key, tier, description, status, dependencies, ownerTeam, latencyMs, errorRate, uptimePercent, requestRateRps } = req.body;

  try {
    const newService = await db.createService({
      name: sanitizeText(name, 100),
      key: key ? sanitizeText(key, 50) : undefined,
      tier: tier || 'TIER-2',
      description: sanitizeText(description, 500) || 'Internal backend service.',
      status: status || 'HEALTHY',
      latencyMs: latencyMs !== undefined ? Number(latencyMs) : 35,
      errorRate: errorRate !== undefined ? Number(errorRate) : 0.01,
      uptimePercent: uptimePercent !== undefined ? Number(uptimePercent) : 99.99,
      requestRateRps: requestRateRps !== undefined ? Number(requestRateRps) : 800,
      dependencies: Array.isArray(dependencies) ? dependencies.map((d: any) => sanitizeText(d, 50)).filter(Boolean) : [],
      ownerTeam: sanitizeText(ownerTeam, 100) || 'Platform Engineering',
    });

    if (req.user) {
      await db.recordAuditLog({
        userId: req.user.id,
        userName: req.user.name,
        userRole: req.user.role,
        action: 'SERVICE_CREATED',
        resourceType: 'SERVICE',
        resourceId: newService.id,
        details: `Service "${newService.name}" (${newService.key}) created in tier ${newService.tier}`,
      });
    }

    res.status(201).json({ service: newService });
  } catch (err: unknown) {
    const msg = sanitizeErrorMessage(err);
    res.status(400).json({ error: msg });
  }
});

apiRouter.patch('/services/:id', authenticate, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  const validation = validateServiceUpdate(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.errors.join('. ') });
  }

  const updated = await db.updateService(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Service not found' });
  }

  if (req.user) {
    await db.recordAuditLog({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'SERVICE_UPDATED',
      resourceType: 'SERVICE',
      resourceId: updated.id,
      details: `Service "${updated.name}" updated (status: ${updated.status})`,
    });
  }

  res.json({ service: updated });
});

apiRouter.delete('/services/:id', authenticate, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  const existing = await db.getServiceById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Service not found' });
  }

  const deleted = await db.deleteService(req.params.id);
  if (!deleted) {
    return res.status(500).json({ error: 'Failed to delete service' });
  }

  if (req.user) {
    await db.recordAuditLog({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'SERVICE_DELETED',
      resourceType: 'SERVICE',
      resourceId: req.params.id,
      details: `Service "${existing.name}" (${existing.id}) deleted by ${req.user.name}`,
    });
  }

  res.json({ success: true, message: `Service ${existing.name} deleted successfully` });
});

apiRouter.get('/services/:id/metrics', authenticate, async (req: Request, res: Response) => {
  const service = await db.getServiceById(req.params.id);
  if (!service) {
    return res.status(404).json({ error: 'Service not found' });
  }
  const metrics = await db.getServiceMetrics(req.params.id);
  res.json({ metrics });
});

// --- Incidents Database Operations ---
apiRouter.get('/incidents', authenticate, async (req: Request, res: Response) => {
  const { page, limit, search, status, severity, serviceId } = req.query;
  if (page || limit || search || status || severity || serviceId) {
    const result = await db.getIncidentsPaginated({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search: typeof search === 'string' ? search : undefined,
      status: typeof status === 'string' ? status : undefined,
      severity: typeof severity === 'string' ? severity : undefined,
      serviceId: typeof serviceId === 'string' ? serviceId : undefined,
    });
    return res.json(result);
  }
  const incidents = await db.getAllIncidents();
  res.json({ incidents, total: incidents.length, page: 1, limit: incidents.length, totalPages: 1 });
});

apiRouter.get('/incidents/:id', authenticate, async (req: Request, res: Response) => {
  const incident = await db.getIncidentById(req.params.id);
  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }
  res.json({ incident });
});

apiRouter.get('/incidents/:id/history', authenticate, async (req: Request, res: Response) => {
  const { page, limit } = req.query;
  if (page || limit) {
    const result = await db.getHistoryForIncidentPaginated(req.params.id, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return res.json(result);
  }
  const history = await db.getHistoryForIncident(req.params.id);
  res.json({ history, total: history.length, page: 1, limit: history.length, totalPages: 1 });
});

apiRouter.get('/incidents/:id/analyses', authenticate, async (req: Request, res: Response) => {
  const analyses = await db.getAllAiAnalysesForIncident(req.params.id);
  res.json({ analyses });
});

apiRouter.post('/incidents', authenticate, requireRole(['ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
  const validation = validateIncidentCreate(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.errors.join('. ') });
  }

  const { title, description, serviceId, severity, errorLogs, assignedEngineerId, triggerAI } = req.body;

  // Verify that target service exists
  const service = await db.getServiceById(serviceId);
  if (!service) {
    return res.status(400).json({ error: `Referenced serviceId "${serviceId}" does not exist` });
  }

  try {
    const incident = await db.createIncident({
      title: sanitizeText(title, 200),
      description: sanitizeText(description, 1000) || 'Operational anomaly identified.',
      serviceId,
      severity,
      errorLogs: typeof errorLogs === 'string' ? sanitizeText(errorLogs, 10000) : undefined,
      assignedEngineerId,
      createdByUserId: req.user?.id,
      createdByUserName: req.user?.name,
    });

    if (req.user) {
      await db.recordAuditLog({
        userId: req.user.id,
        userName: req.user.name,
        userRole: req.user.role,
        action: 'INCIDENT_CREATED',
        resourceType: 'INCIDENT',
        resourceId: incident.id,
        details: `Incident "${incident.title}" declared on ${incident.serviceName} with severity ${incident.severity}`,
      });
    }

    // Automatically trigger AI if requested or configured (and not explicitly disabled or test mode)
    const settings = await db.getSettings();
    const isTest = process.env.NODE_ENV === 'test';
    if (triggerAI === true || (!isTest && triggerAI !== false && settings.autoAiAnalysisOnCritical && (severity === 'CRITICAL' || severity === 'HIGH'))) {
      try {
        const aiResult = await analyzeIncidentWithAI({
          incidentId: incident.id,
          title: incident.title,
          description: incident.description,
          serviceName: incident.serviceName,
          severity: incident.severity,
          errorLogs: incident.errorLogs,
          modelName: settings.geminiModel,
        });

        // Save AI analysis to database
        await db.saveAiAnalysis({
          incidentId: incident.id,
          modelUsed: aiResult.modelUsed || settings.geminiModel,
          summary: aiResult.incidentSummary || aiResult.rootCauseSummary || 'Incident analyzed',
          probableRootCause: aiResult.probableRootCause || 'Under investigation',
          possibleCauses: aiResult.possibleAlternativeCauses || aiResult.probableCauseChain || [],
          recommendedActions: aiResult.recommendedTroubleshootingSteps || aiResult.mitigationSteps || [],
          severityAssessment: aiResult.severityAssessment || severity,
          confidence: aiResult.confidenceScore ?? 85,
          riskFactors: aiResult.riskFactors || [],
          preventionSuggestions: aiResult.preventionSuggestions || aiResult.preventionRecommendations || [],
          runbookCommands: aiResult.runbookCommands || [],
          analyzedByUserId: req.user?.id,
          analyzedByUserName: req.user?.name,
        });
      } catch (e) {
        console.warn('Auto AI analysis error:', sanitizeErrorMessage(e));
      }
    }

    res.status(201).json({ incident: await db.getIncidentById(incident.id) });
  } catch (err: unknown) {
    const msg = sanitizeErrorMessage(err);
    res.status(400).json({ error: msg });
  }
});

apiRouter.patch('/incidents/:id', authenticate, requireRole(['ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
  const validation = validateIncidentUpdate(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.errors.join('. ') });
  }

  const performer = req.user ? { id: req.user.id, name: req.user.name } : undefined;
  const updated = await db.updateIncident(req.params.id, req.body, performer);
  if (!updated) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  if (req.user) {
    await db.recordAuditLog({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'INCIDENT_UPDATED',
      resourceType: 'INCIDENT',
      resourceId: updated.id,
      details: `Incident ${updated.id} updated (status: ${updated.status}, severity: ${updated.severity})`,
    });
  }

  res.json({ incident: updated });
});

apiRouter.delete('/incidents/:id', authenticate, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  const existing = await db.getIncidentById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  const deleted = await db.deleteIncident(req.params.id);
  if (!deleted) {
    return res.status(500).json({ error: 'Failed to delete incident' });
  }

  if (req.user) {
    await db.recordAuditLog({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'INCIDENT_DELETED',
      resourceType: 'INCIDENT',
      resourceId: req.params.id,
      details: `Incident "${existing.title}" (${existing.id}) deleted by ${req.user.name}`,
    });
  }

  res.json({ success: true, message: `Incident ${existing.id} deleted successfully` });
});

apiRouter.post('/incidents/:id/assign', authenticate, requireRole(['ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
  const { engineerId } = req.body;
  if (!engineerId) {
    return res.status(400).json({ error: 'engineerId is required' });
  }

  const engineer = await db.getEngineerById(engineerId);
  if (!engineer) {
    return res.status(404).json({ error: 'Engineer not found' });
  }

  const performer = req.user ? { id: req.user.id, name: req.user.name } : undefined;
  const updated = await db.updateIncident(req.params.id, { assignedEngineer: engineer }, performer);
  if (!updated) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  if (req.user) {
    await db.recordAuditLog({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'INCIDENT_ASSIGNED',
      resourceType: 'INCIDENT',
      resourceId: updated.id,
      details: `Incident ${updated.id} assigned to ${engineer.name}`,
    });
  }

  res.json({ incident: updated });
});

apiRouter.post('/incidents/:id/resolve', authenticate, requireRole(['ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
  const { resolutionNotes } = req.body;
  const performer = req.user ? { id: req.user.id, name: req.user.name } : undefined;
  const updated = await db.resolveIncident(
    req.params.id,
    resolutionNotes || 'Incident verified and marked resolved by engineer on-call.',
    performer
  );

  if (!updated) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  if (req.user) {
    await db.recordAuditLog({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'INCIDENT_RESOLVED',
      resourceType: 'INCIDENT',
      resourceId: updated.id,
      details: `Incident ${updated.id} marked RESOLVED by ${req.user.name}`,
    });
  }

  res.json({ incident: updated });
});

// --- AI Diagnostic Endpoints ---
apiRouter.post('/ai/analyze-incident', authenticate, requireRole(['ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
  const {
    incidentId,
    title,
    description,
    serviceName,
    serviceId,
    severity,
    status,
    errorLogs,
    performanceMetrics,
    recentIncidents,
  } = req.body;

  try {
    // 1. Gather rich context from database
    let incident = incidentId ? await db.getIncidentById(incidentId) : null;
    let resolvedService = serviceId
      ? await db.getServiceById(serviceId)
      : (incident ? await db.getServiceById(incident.serviceId) : (await db.getAllServices()).find((s) => s.name === serviceName));

    const allMetrics = await db.getReliabilityMetrics();
    const systemIncidents = await db.getAllIncidents();

    const finalTitle = title || (incident ? incident.title : 'Unspecified Service Disruption');
    const finalDescription = description || (incident ? incident.description : 'Operational degradation under active investigation.');
    const finalServiceName = resolvedService ? resolvedService.name : (serviceName || (incident ? incident.serviceName : 'General Infrastructure'));
    const finalSeverity = severity || (incident ? incident.severity : 'HIGH');
    const finalStatus = status || (incident ? incident.status : 'INVESTIGATING');

    // Collect logs
    let finalLogs = errorLogs || (incident ? incident.errorLogs : '');
    if (!finalLogs && resolvedService) {
      const serviceLogs = await db.getLogs({ serviceId: resolvedService.id });
      if (serviceLogs.length > 0) {
        finalLogs = serviceLogs.slice(0, 10).map((l) => `[${l.timestamp}] ${l.level} [${l.serviceName}]: ${l.message}\n${l.stackTrace || ''}`).join('\n');
      }
    }

    const finalMetrics = performanceMetrics || (resolvedService ? {
      latencyMs: resolvedService.latencyMs,
      errorRate: resolvedService.errorRate,
      uptimePercent: resolvedService.uptimePercent,
      requestRateRps: resolvedService.requestRateRps,
      systemAvailability: allMetrics.systemAvailability,
      errorBudgetBurnRate: allMetrics.errorBudgetBurnRate,
    } : {
      systemAvailability: allMetrics.systemAvailability,
      errorBudgetBurnRate: allMetrics.errorBudgetBurnRate,
    });

    const finalRecentIncidents = recentIncidents || systemIncidents
      .filter((i) => i.id !== incidentId)
      .slice(0, 5)
      .map((i) => ({
        id: i.id,
        title: i.title,
        severity: i.severity,
        status: i.status,
        serviceName: i.serviceName,
      }));

    // 2. Call Gemini server-side AI service
    const currentSettings = await db.getSettings();
    const modelUsed = currentSettings.geminiModel || 'gemini-3.8-flash';

    const analysis = await analyzeIncidentWithAI({
      incidentId: incidentId || 'AD-HOC-ANALYSIS',
      title: finalTitle,
      description: finalDescription,
      serviceName: finalServiceName,
      severity: finalSeverity,
      status: finalStatus,
      errorLogs: finalLogs,
      modelName: modelUsed,
      performanceMetrics: finalMetrics,
      recentIncidents: finalRecentIncidents,
    });

    // 3. Save successful AI analysis to database
    if (incidentId) {
      const savedAi = await db.saveAiAnalysis({
        incidentId,
        modelUsed: analysis.modelUsed || modelUsed,
        summary: analysis.incidentSummary || analysis.rootCauseSummary || 'Incident analyzed',
        probableRootCause: analysis.probableRootCause || 'Root cause identified',
        possibleCauses: analysis.possibleAlternativeCauses || analysis.probableCauseChain || [],
        recommendedActions: analysis.recommendedTroubleshootingSteps || analysis.mitigationSteps || [],
        severityAssessment: analysis.severityAssessment || finalSeverity,
        confidence: analysis.confidenceScore ?? 85,
        riskFactors: analysis.riskFactors || [],
        preventionSuggestions: analysis.preventionSuggestions || analysis.preventionRecommendations || [],
        runbookCommands: analysis.runbookCommands || [],
        analyzedByUserId: req.user?.id,
        analyzedByUserName: req.user?.name,
      });

      incident = await db.getIncidentById(incidentId);

      res.json({
        analysis: savedAi,
        incident,
        savedWithIncident: true,
      });
      return;
    }

    res.json({
      analysis,
      incident: null,
      savedWithIncident: false,
    });
  } catch (err: unknown) {
    const errorObj = err as any;
    const rawErrorMsg = errorObj?.message || 'Failed to complete AI incident analysis';
    const is503 = errorObj?.status === 503 || errorObj?.isHighDemand || rawErrorMsg.includes('503') || rawErrorMsg.toLowerCase().includes('high demand') || rawErrorMsg.toLowerCase().includes('unavailable');
    const is429 = errorObj?.status === 429 || rawErrorMsg.includes('429') || rawErrorMsg.toLowerCase().includes('resource_exhausted') || rawErrorMsg.toLowerCase().includes('quota') || rawErrorMsg.toLowerCase().includes('rate limit');
    const isTimeout = rawErrorMsg.toLowerCase().includes('timeout') || rawErrorMsg.toLowerCase().includes('timed out');

    let statusCode = 500;
    let safeMessage = sanitizeErrorMessage(rawErrorMsg);
    if (is429) {
      statusCode = 429;
      safeMessage = 'Gemini AI rate limit or quota exceeded. Please retry in a few moments.';
    } else if (is503) {
      statusCode = 503;
      safeMessage = 'Gemini AI service is currently experiencing high demand. Please retry in a few moments.';
    } else if (isTimeout) {
      statusCode = 504;
      safeMessage = 'Gemini AI analysis timed out. Please retry.';
    }

    console.error(`AI Incident Analysis error [${statusCode}]:`, sanitizeErrorMessage(rawErrorMsg));

    const settingsNow = await db.getSettings();
    res.status(statusCode).json({
      error: safeMessage,
      isHighDemand: is503,
      isRateLimit: is429,
      isTimeout,
      confidenceUnavailable: true,
      modelUsed: settingsNow.geminiModel || 'gemini-3.8-flash',
    });
  }
});

apiRouter.post('/ai/analyze-logs', authenticate, requireRole(['ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
  const { serviceName, serviceId, rawLogs, logs } = req.body;

  try {
    const resolvedService = serviceId
      ? await db.getServiceById(serviceId)
      : (await db.getAllServices()).find((s) => s.name === serviceName);

    const metrics = resolvedService ? {
      latencyMs: resolvedService.latencyMs,
      errorRate: resolvedService.errorRate,
    } : undefined;

    const currentSettings = await db.getSettings();
    const modelUsed = currentSettings.geminiModel || 'gemini-3.8-flash';

    const analysis = await analyzeLogsWithAI({
      serviceName: resolvedService ? resolvedService.name : (serviceName || 'Target Service'),
      rawLogs: typeof rawLogs === 'string' ? rawLogs : undefined,
      logs: Array.isArray(logs) ? logs : undefined,
      modelName: modelUsed,
      performanceMetrics: metrics,
    });

    if (req.user) {
      await db.recordAuditLog({
        userId: req.user.id,
        userName: req.user.name,
        userRole: req.user.role,
        action: 'AI_LOG_ANALYSIS',
        resourceType: 'LOGS',
        resourceId: serviceId || resolvedService?.id,
        details: `Log analysis performed by ${req.user.name} on ${resolvedService?.name || serviceName}`,
      });
    }

    res.json({ analysis });
  } catch (err: unknown) {
    const errorObj = err as any;
    const rawErrorMsg = errorObj?.message || 'Failed to analyze logs with AI';
    const is503 = errorObj?.status === 503 || errorObj?.isHighDemand || rawErrorMsg.includes('503') || rawErrorMsg.toLowerCase().includes('high demand') || rawErrorMsg.toLowerCase().includes('unavailable');
    const is429 = errorObj?.status === 429 || rawErrorMsg.includes('429') || rawErrorMsg.toLowerCase().includes('resource_exhausted') || rawErrorMsg.toLowerCase().includes('quota') || rawErrorMsg.toLowerCase().includes('rate limit');
    const isTimeout = rawErrorMsg.toLowerCase().includes('timeout') || rawErrorMsg.toLowerCase().includes('timed out');

    let statusCode = 500;
    let safeMessage = sanitizeErrorMessage(rawErrorMsg);
    if (is429) {
      statusCode = 429;
      safeMessage = 'Gemini AI rate limit or quota exceeded. Please retry in a few moments.';
    } else if (is503) {
      statusCode = 503;
      safeMessage = 'Gemini AI service is currently experiencing high demand. Please retry in a few moments.';
    } else if (isTimeout) {
      statusCode = 504;
      safeMessage = 'Gemini AI analysis timed out. Please retry.';
    }

    console.error(`AI Log Analysis error [${statusCode}]:`, sanitizeErrorMessage(rawErrorMsg));
    const settingsNow = await db.getSettings();
    res.status(statusCode).json({
      error: safeMessage,
      isHighDemand: is503,
      isRateLimit: is429,
      isTimeout,
      modelUsed: settingsNow.geminiModel || 'gemini-3.8-flash',
    });
  }
});

// --- Telemetry Logs ---
apiRouter.get('/logs', authenticate, async (req: Request, res: Response) => {
  const { serviceId, level, search } = req.query;
  const logs = await db.getLogs({
    serviceId: typeof serviceId === 'string' ? serviceId : undefined,
    level: typeof level === 'string' ? level : undefined,
    search: typeof search === 'string' ? search : undefined,
  });
  res.json({ logs });
});

apiRouter.post('/logs/simulate', authenticate, requireRole(['ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
  const { serviceId, level, message, stackTrace } = req.body;
  const allServices = await db.getAllServices();
  const service = (serviceId ? await db.getServiceById(serviceId) : null) || allServices[0];

  const newLog = await db.addLog({
    serviceId: service.id,
    serviceName: service.name,
    level: level || 'ERROR',
    message: message || `Simulated error log entry on ${service.key}`,
    traceId: `trace-${Math.random().toString(36).substring(2, 9)}`,
    stackTrace: stackTrace || `Error: Simulated failure\n  at handleRequest (src/server.ts:42:12)`,
  });

  res.status(201).json({ log: newLog });
});

// --- Engineers ---
apiRouter.get('/engineers', authenticate, async (req: Request, res: Response) => {
  const engineers = await db.getAllEngineers();
  res.json({ engineers });
});

apiRouter.patch('/engineers/:id', authenticate, requireRole(['ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
  const updated = await db.updateEngineer(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Engineer not found' });
  }

  if (req.user) {
    await db.recordAuditLog({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'ENGINEER_ROTATION_UPDATED',
      resourceType: 'ENGINEER',
      resourceId: updated.id,
      details: `Engineer ${updated.name} updated to ${updated.status} (${updated.shift_end})`,
    });
  }

  res.json({ engineer: updated });
});

// --- Dynamic Dashboard Metrics ---
apiRouter.get('/metrics', authenticate, async (req: Request, res: Response) => {
  const metrics = await db.getReliabilityMetrics();
  res.json({ metrics });
});

// --- Settings ---
apiRouter.get('/settings', authenticate, async (req: Request, res: Response) => {
  const settings = await db.getSettings();
  res.json({ settings });
});

apiRouter.put('/settings', authenticate, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  const updated = await db.updateSettings(req.body);

  if (req.user) {
    await db.recordAuditLog({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'SETTINGS_UPDATED',
      resourceType: 'SETTINGS',
      details: `Platform settings updated by ${req.user.name}`,
    });
  }

  res.json({ settings: updated });
});

// --- Audit Logs ---
apiRouter.get('/audit-logs', authenticate, async (req: Request, res: Response) => {
  const { page, limit, search, action, userId } = req.query;
  if (page || search || action || userId) {
    const result = await db.getAuditLogsPaginated({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : 50,
      search: typeof search === 'string' ? search : undefined,
      action: typeof action === 'string' ? action : undefined,
      userId: typeof userId === 'string' ? userId : undefined,
    });
    return res.json(result);
  }
  const parsedLimit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const auditLogs = await db.getAuditLogs(isNaN(parsedLimit) ? 50 : parsedLimit);
  res.json({ auditLogs, total: auditLogs.length, page: 1, limit: isNaN(parsedLimit) ? 50 : parsedLimit, totalPages: 1 });
});

// --- Seed Reset ---
apiRouter.post('/reset-seed', authenticate, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  if (db.ensureInitialData) {
    await db.ensureInitialData(true);
  }

  if (req.user) {
    await db.recordAuditLog({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'SEED_RESET',
      resourceType: 'SYSTEM',
      details: `Database reseeded to canonical state by ${req.user.name}`,
    });
  }

  const allServices = await db.getAllServices();
  const allIncidents = await db.getAllIncidents();

  res.json({
    message: 'System database restored to canonical demo state.',
    servicesCount: allServices.length,
    incidentsCount: allIncidents.length,
  });
});

// ==========================================
// --- REAL SYSTEM HEALTH & MONITORING ---
// ==========================================

// Full Monitoring Overview (Authenticated: ADMIN, ENGINEER, VIEWER)
apiRouter.get('/monitoring/overview', authenticate, async (req: Request, res: Response) => {
  const systemHealth = await telemetryMonitor.getSystemHealthReport();
  const apiPerformance = telemetryMonitor.getApiPerformance();
  const servicesHealth = await db.getServiceHealthDetails();
  const incidentMonitoring = await db.getIncidentMonitoringStats();

  res.json({
    systemHealth,
    apiPerformance,
    servicesHealth,
    incidentMonitoring,
  });
});

// Real-time API Performance Telemetry (Authenticated)
apiRouter.get('/monitoring/performance', authenticate, (req: Request, res: Response) => {
  res.json({
    apiPerformance: telemetryMonitor.getApiPerformance(),
  });
});

// Application Error Monitoring (RBAC: ADMIN, ENGINEER)
apiRouter.get('/monitoring/errors', authenticate, requireRole(['ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const errors = await db.getSystemErrors(isNaN(limit) ? 50 : limit);
  const recentApiErrors = telemetryMonitor.getApiPerformance().recentErrors;

  res.json({
    errors,
    recentApiErrors,
  });
});

// Clear System Errors (RBAC: ADMIN only)
apiRouter.post('/monitoring/errors/clear', authenticate, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  await db.clearSystemErrors();

  if (req.user) {
    await db.recordAuditLog({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'SYSTEM_ERRORS_CLEARED',
      resourceType: 'MONITORING',
      details: `System error logs cleared by ${req.user.name}`,
    });
  }

  res.json({ success: true, message: 'System error records cleared successfully' });
});

// Trigger Live Health Probes for Database & Gemini AI (RBAC: ADMIN, ENGINEER)
apiRouter.post('/monitoring/probe', authenticate, requireRole(['ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
  try {
    const aiProbe = await telemetryMonitor.probeGeminiAiHealthLive();
    const dbHealth = await telemetryMonitor.checkDatabaseHealth();
    const systemReport = await telemetryMonitor.getSystemHealthReport();

    if (req.user) {
      await db.recordAuditLog({
        userId: req.user.id,
        userName: req.user.name,
        userRole: req.user.role,
        action: 'HEALTH_PROBE_EXECUTED',
        resourceType: 'MONITORING',
        details: `Live system health probe executed by ${req.user.name} (DB: ${dbHealth.status}, AI: ${aiProbe.status})`,
      });
    }

    res.json({
      geminiAi: aiProbe,
      database: dbHealth,
      systemReport,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

// Probe Individual Registered Service (RBAC: ADMIN, ENGINEER)
apiRouter.post('/monitoring/services/:id/probe', authenticate, requireRole(['ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
  const updated = await db.probeServiceHealth(req.params.id);
  if (!updated) {
    return res.status(404).json({ error: 'Service not found' });
  }

  if (req.user) {
    await db.recordAuditLog({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'SERVICE_HEALTH_PROBE',
      resourceType: 'SERVICE',
      resourceId: updated.id,
      details: `Service ${updated.name} probe executed: status is now ${updated.status} (${updated.latencyMs}ms)`,
    });
  }

  res.json({ service: updated });
});

// Centralized API Error Handling Middleware
apiRouter.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = typeof err.status === 'number' ? err.status : 500;
  const safeMessage = sanitizeErrorMessage(err);
  console.error(`Centralized API error handler caught [${status}]:`, safeMessage);

  res.status(status).json({
    error: safeMessage,
    code: err.code || (status === 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR'),
  });
});
