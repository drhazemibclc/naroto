declare module 'jstat' {
  export const jStat: {
    normal: {
      cdf: (z: number, mean: number, variance: number) => number;
      inv: (p: number, mean: number, variance: number) => number;
      pdf: (x: number, mean: number, variance: number) => number;
      sample: (mean: number, variance: number) => number;
    };
    studentt: {
      cdf: (t: number, dof: number) => number;
      inv: (p: number, dof: number) => number;
      pdf: (x: number, dof: number) => number;
      sample: (dof: number) => number;
    };
    beta: {
      cdf: (x: number, alpha: number, beta: number) => number;
      inv: (p: number, alpha: number, beta: number) => number;
      pdf: (x: number, alpha: number, beta: number) => number;
    };
    gamma: {
      cdf: (x: number, shape: number, scale: number) => number;
      inv: (p: number, shape: number, scale: number) => number;
      pdf: (x: number, shape: number, scale: number) => number;
    };
    binomial: {
      cdf: (x: number, n: number, p: number) => number;
      pdf: (k: number, n: number, p: number) => number;
    };
    poisson: {
      cdf: (x: number, lambda: number) => number;
      pdf: (k: number, lambda: number) => number;
    };
    exponential: {
      cdf: (x: number, lambda: number) => number;
      inv: (p: number, lambda: number) => number;
      pdf: (x: number, lambda: number) => number;
    };
    uniform: {
      cdf: (x: number, a: number, b: number) => number;
      inv: (p: number, a: number, b: number) => number;
      pdf: (x: number, a: number, b: number) => number;
    };
    chisquare: {
      cdf: (x: number, dof: number) => number;
      inv: (p: number, dof: number) => number;
      pdf: (x: number, dof: number) => number;
    };
    F: {
      cdf: (x: number, dof1: number, dof2: number) => number;
      inv: (p: number, dof1: number, dof2: number) => number;
      pdf: (x: number, dof1: number, dof2: number) => number;
    };

    // Statistical functions
    mean: (arr: number[]) => number;
    median: (arr: number[]) => number;
    mode: (arr: number[]) => number;
    stdev: (arr: number[], flag?: boolean) => number;
    variance: (arr: number[], flag?: boolean) => number;
    min: (arr: number[]) => number;
    max: (arr: number[]) => number;
    sum: (arr: number[]) => number;
    cumsum: (arr: number[]) => number[];
    percentile: (arr: number[], p: number) => number;
    quantiles: (arr: number[], quantilesArray: number[]) => number[];

    // Linear algebra
    multiply: (a: number[][], b: number[][]) => number[][];
    inverse: (a: number[][]) => number[][];
    transpose: (a: number[][]) => number[][];

    // Utility
    seq: (start: number, end: number, step?: number) => number[];
    rand: (n?: number) => number | number[];
  };

  export default jStat;
}
