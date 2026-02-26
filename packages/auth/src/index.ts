import { sendEmail } from '@better-auth/dash';
import { prisma } from '@naroto/db';
import { env } from '@naroto/env/server';
import { APIError, betterAuth, generateId } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { admin, customSession, twoFactor } from 'better-auth/plugins';

import { ac, roles } from './roles';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql'
  }),

  trustedOrigins: [env.CORS_ORIGIN],
  emailAndPassword: {
    enabled: true,
    async sendResetPassword({ user, url }) {
      await sendEmail({
        to: user.email,
        subject: 'Reset your password',
        template: 'reset-password',
        variables: {
          userEmail: user.email,
          resetLink: url,
          userName: user.name
        }
      });
    }
  },
  experimental: { joins: true },
  baseURL: process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL,
  advanced: {
    database: {
      generateId: () => generateId(),
      defaultFindManyLimit: 100
    },
    useSecureCookies: false, // Good for local HTTP
    cookiePrefix: 'auth',
    crossSubDomainCookies: {
      enabled: true,
      domain: 'localhost'
    }
  },
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'error' : 'info',
    disabled: false
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'DOCTOR',
        input: false
      },
      phone: {
        type: 'string',
        required: false,
        input: true
      },
      isAdmin: {
        type: 'boolean',
        required: false,
        defaultValue: false,
        input: false
      }
    },
    deleteUser: {
      enabled: true,
      beforeDelete: async user => {
        // Query database for additional fields
        const fullUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true, isAdmin: true }
        });

        if (fullUser?.role?.toLowerCase() === 'admin' || fullUser?.isAdmin) {
          throw new APIError('BAD_REQUEST', {
            message: "Admin accounts can't be deleted"
          });
        }
      }
    },
    changeEmail: {
      enabled: true
    }
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    storeSessionInDatabase: true,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60 // 5 minutes
    }
  },
  account: {
    encryptOAuthTokens: true,
    accountLinking: {
      enabled: true
    }
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string
    }
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    storage: 'memory', // Increased default for general API calls
    customRules: {
      // Allow frequent session checks (needed for client-side auth)
      '/get-session': {
        window: 60,
        max: 60
      },
      // Rate limit for sign-in to prevent brute force and credential stuffing attacks
      '/sign-in/email': {
        window: 300, // 5 minutes
        max: 5 // max 5 login attempts per 5 minutes
      },
      // Rate limit for user and provider signup to prevent spam and abuse
      '/sign-up/email': {
        window: 300, // 5 minutes
        max: 5 // max 5 signup attempts per 5 minutes
      },
      // Stricter rate limit for forgot password to prevent email enumeration and spam
      '/forget-password': {
        window: 300, // 5 minutes
        max: 3 // max 3 requests per 5 minutes
      },
      // Also limit reset password attempts
      '/reset-password': {
        window: 300, // 5 minutes
        max: 5 // max 5 attempts per 5 minutes
      }
    }
  },
  databaseHooks: {
    user: {
      create: {
        before: async user => {
          const email = user.email?.trim().toLowerCase();
          if (!(email && EMAIL_REGEX.test(email))) {
            throw new APIError('BAD_REQUEST', {
              message: 'Invalid email format'
            });
          }
          return {
            data: {
              ...user,
              email,
              name: user.name?.trim() || 'Unnamed User',
              role: 'PATIENT',
              isAdmin: false
            }
          };
        }
      }
    }
  },

  plugins: [
    twoFactor(),
    admin({
      ac,
      roles
    }),
    customSession(async ({ user, session }) => {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          role: true,
          clinicMembers: {
            select: {
              userId: true,
              role: true,
              user: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      });

      const primaryClinic = dbUser?.clinicMembers?.length ? dbUser.clinicMembers[0] : null;

      return {
        ...session,
        user: {
          ...user,
          role: dbUser?.role?.toLowerCase() ?? 'patient',
          clinic: primaryClinic
            ? {
                id: primaryClinic.userId,
                name: primaryClinic.user.name
              }
            : undefined
        }
      };
    }),
    nextCookies()
  ]
});

export type Session = typeof auth.$Infer.Session;
export type User = Session['user'] & { role: string };
export type Role = Uppercase<User['role']>;
