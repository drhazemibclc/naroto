import type { Prisma } from '../../generated/browser';

export const buildQuery = (id?: string, search?: string) => {
  // Base conditions for search if it exists
  const searchConditions: Prisma.AppointmentWhereInput = search
    ? {
        OR: [
          {
            patient: {
              firstName: { contains: search, mode: 'insensitive' }
            }
          },
          {
            patient: {
              lastName: { contains: search, mode: 'insensitive' }
            }
          },
          {
            doctor: {
              name: { contains: search, mode: 'insensitive' }
            }
          }
        ]
      }
    : {};

  // ID filtering conditions if ID exists
  const idConditions: Prisma.AppointmentWhereInput = id
    ? {
        OR: [{ patientId: id }, { doctorId: id }]
      }
    : {};

  // Combine both conditions with AND if both exist
  const combinedQuery: Prisma.AppointmentWhereInput =
    id || search
      ? {
          AND: [
            ...(Object.keys(searchConditions).length > 0 ? [searchConditions] : []),
            ...(Object.keys(idConditions).length > 0 ? [idConditions] : [])
          ]
        }
      : {};

  return combinedQuery;
};
