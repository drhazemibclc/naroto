// src/components/skeletons/table-skeleton.tsx
import type React from 'react';
import { useId } from 'react';

interface TableSkeletonProps {
  columns?: number;
  rows?: number;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 5, columns = 5 }) => {
  const Id = useId();
  return (
    <div className='w-full overflow-x-auto'>
      <table className='w-full table-auto border-collapse'>
        <thead>
          <tr>
            {Array.from({ length: columns }).map(_ => (
              <th
                className='border-b p-2'
                key={Id + 2}
              >
                <div className='h-4 w-full animate-pulse rounded bg-gray-200' />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map(_ => (
            <tr key={Id}>
              {Array.from({ length: columns }).map(_ => (
                <td
                  className='border-b p-2'
                  key={Id + 1}
                >
                  <div className='h-4 w-full animate-pulse rounded bg-gray-200' />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
