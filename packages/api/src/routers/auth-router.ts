import { auth } from '@naroto/auth';
import { resetPasswordFormSchema, signupFormSchema, userSchema } from '@naroto/db/zodSchemas/auth.schema';
import z from 'zod';

import { createTRPCRouter, protectedProcedure, publicProcedure } from '..';
import { createServerRoleChecker, getRole } from '../utils';

export const authRouter = createTRPCRouter({
  // signUp: publicProcedure.input(signupFormSchema).mutation(async ({ input: values }) => {
  //     console.log('SignUp values:', values);
  //     return await auth.api.signUpEmail({
  //         body: { isDeleted: false, ...values }
  //     });
  // }),

  signIn: publicProcedure.input(signupFormSchema.omit({ name: true })).mutation(async ({ input: values }) => {
    return await auth.api.signInEmail({
      body: values
    });
  }),

  requestPasswordReset: publicProcedure.input(userSchema.shape.email).mutation(async ({ input: email }) => {
    await auth.api.requestPasswordReset({
      body: {
        email,
        redirectTo: '/reset-password'
      }
    });
  }),
  resetPassword: publicProcedure.input(resetPasswordFormSchema).mutation(async ({ input: values }) => {
    await auth.api.resetPassword({
      body: {
        newPassword: values.confirmPassword,
        token: values.token
      }
    });

    return { success: true };
  }),
  getRole: publicProcedure.query(async ({ ctx }) => {
    // Get session from headers
    const session = ctx.session;

    return {
      role: getRole(session).toString(),
      user: session?.user,
      permissions: await createServerRoleChecker(auth)(session)
    };
  }),
  getSession: publicProcedure.query(async ({ ctx }) => {
    try {
      const session = await auth.api.getSession({
        headers: ctx.headers
      });

      return {
        session: session || null,
        user: session?.user || null
      };
    } catch (error) {
      console.error('Failed to get session:', error);
      return {
        session: null,
        user: null
      };
    }
  }),
  me: protectedProcedure.query(async ({ ctx }) => {
    const session = ctx.session;
    const user = ctx.user;
    return {
      ...session?.user,
      permissions: await createServerRoleChecker(auth)(session),

      user,
      full_name: session?.user.name, // Map name to full_name if needed
      role: user?.role
    };
  }),

  // Other auth procedures...
  login: publicProcedure
    .input(z.object({ email: z.email(), password: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { email, password } = input;

      const session = await auth.api.signInEmail({
        body: {
          email,
          password
        },
        headers: ctx.headers
      });

      return session;
      // implementation
    })
});
