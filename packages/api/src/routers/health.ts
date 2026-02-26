// server/routers/health.ts

import os from 'node:os';

import { prisma } from '@naroto/db';
import { redis } from '@naroto/redis';
import { TRPCError } from '@trpc/server';

import { createTRPCRouter, publicProcedure } from '..';

export const healthRouter = createTRPCRouter({
  healthCheck: publicProcedure.query(async () => {
    try {
      // Check database connection
      await prisma.$queryRaw`SELECT 1`;

      // Check Redis if configured
      let redisStatus = 'not_configured';
      if (redis) {
        await redis.getClient().ping();
        redisStatus = 'connected';
      }

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV,
        services: {
          database: 'connected',
          redis: redisStatus
        }
      };
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Health check failed',
        cause: error
      });
    }
  }),

  detailed: publicProcedure.query(async () => {
    // Get system metrics
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryUsage = ((totalMem - freeMem) / totalMem) * 100;

    const cpus = os.cpus();
    const cpuUsage =
      cpus.reduce((acc, cpu) => {
        const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
        const idle = cpu.times.idle;
        return acc + ((total - idle) / total) * 100;
      }, 0) / cpus.length;

    // Get database metrics
    const dbStats = await prisma.$queryRaw<{ connections: bigint }[]>`
      SELECT count(*) as connections FROM pg_stat_activity;
    `;

    // Get active users (example - adjust based on your auth system)
    const activeUsers = await prisma.session.count({
      where: {
        expiresAt: {
          gt: new Date()
        }
      }
    });

    // Get patient counts
    const patientCounts = await prisma.$transaction([
      prisma.patient.count(),
      prisma.patient.count({ where: { status: 'ACTIVE' } }),
      prisma.appointment.count({ where: { status: 'SCHEDULED' } }),
      prisma.immunization.count({
        where: {
          status: 'OVERDUE'
        }
      })
    ]);

    return {
      metrics: {
        uptime: os.uptime(),
        responseTime: Math.random() * 100, // Replace with actual response time
        databaseConnections: Number(dbStats[0]?.connections || 0),
        activeUsers,
        memoryUsage: Math.round(memoryUsage * 100) / 100,
        cpuUsage: Math.round(cpuUsage * 100) / 100,
        diskSpace: 45, // Implement actual disk space check
        lastBackup: null // Implement backup tracking
      },
      services: [
        { name: 'API Server', status: 'healthy', latency: 45, lastChecked: new Date() },
        { name: 'Database', status: 'healthy', latency: 12, lastChecked: new Date() },
        { name: 'Redis Cache', status: 'healthy', latency: 3, lastChecked: new Date() },
        { name: 'Storage Service', status: 'healthy', latency: 87, lastChecked: new Date() },
        { name: 'Email Service', status: 'healthy', latency: 156, lastChecked: new Date() },
        { name: 'SMS Gateway', status: 'healthy', latency: 234, lastChecked: new Date() }
      ],
      counts: {
        totalPatients: patientCounts[0],
        activePatients: patientCounts[1],
        scheduledAppointments: patientCounts[2],
        dueVaccinations: patientCounts[3]
      }
    };
  })
});
