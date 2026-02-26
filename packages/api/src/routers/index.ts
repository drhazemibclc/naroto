import { protectedProcedure, publicProcedure, router } from '../index';
import { adminRouter } from './admin.router';
import { appointmentRouter } from './appointment.router';
import { authRouter } from './auth-router';
import { clinicRouter } from './clinic.router';
import { dashboardRouter } from './dashboard';
import { doctorRouter } from './doctor.router';
import { growthRouter } from './growth.router';
import { healthRouter } from './health';
import { medicalRouter } from './medical.router';
import { notificationsRouter } from './notification';
import { paymentsRouter } from './Payment.router';
import { patientRouter } from './patient.router';
import { searchRouter } from './search';
import { serviceRouter } from './service.router';
import { staffRouter } from './staff';
import { todoRouter } from './todo';
import { userRouter } from './user';
import { vaccinationRouter } from './vac.router';
import { visitRouter } from './visit.router';

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return 'OK';
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: 'This is private',
      user: ctx.session.user
    };
  }),
  todo: todoRouter,
  admin: adminRouter,
  appointment: appointmentRouter,
  auth: authRouter,
  clinic: clinicRouter,
  dashboard: dashboardRouter,
  doctor: doctorRouter,
  growth: growthRouter,
  health: healthRouter,
  medical: medicalRouter,
  notification: notificationsRouter,
  patient: patientRouter,
  Payment: paymentsRouter,
  search: searchRouter,
  service: serviceRouter,
  staff: staffRouter,
  user: userRouter,
  vac: vaccinationRouter,
  visit: visitRouter
});
export type AppRouter = typeof appRouter;
