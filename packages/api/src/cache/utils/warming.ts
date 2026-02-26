import { ChartType, Gender } from '@naroto/db/types';

/**
 * 🔥 Cache Warming
 * Following BEST_PRACTICES.md - Pre-populate cache for common queries
 */
export async function warmCache() {
  console.log('🔥 Warming cache...');
  const start = Date.now();

  try {
    // This will be called from instrumentation.ts
    // Dynamic imports to avoid circular deps

    const warmups = [
      // WHO Growth Standards - all combinations
      import('../system.cache').then(async m => {
        await Promise.all([
          m.getCachedWHOGrowthStandards(Gender.MALE, ChartType.WFA),
          m.getCachedWHOGrowthStandards(Gender.FEMALE, ChartType.WFA),
          m.getCachedWHOGrowthStandards(Gender.MALE, ChartType.HFA),
          m.getCachedWHOGrowthStandards(Gender.FEMALE, ChartType.HFA),
          m.getCachedWHOGrowthStandards(Gender.MALE, ChartType.HcFA),
          m.getCachedWHOGrowthStandards(Gender.FEMALE, ChartType.HcFA),
          m.getCachedAllWHOGrowthStandards()
        ]);
      }),

      // Drug database
      import('../system.cache').then(async m => {
        const drugs = await m.getCachedAllDrugs();
        // Warm first 20 drugs by name
        await Promise.all(drugs.slice(0, 20).map((drug: { name: string }) => m.getCachedDrugByName(drug.name)));
      }),

      // Vaccine schedule
      import('../system.cache').then(m => m.getCachedVaccineSchedule())
    ];

    await Promise.allSettled(warmups);

    const duration = Date.now() - start;
    console.log(`✅ Cache warmed in ${duration}ms`);
  } catch (error) {
    console.error('❌ Cache warming failed:', error);
  }
}

export async function warmClinicCache(clinicId: string) {
  console.log(`🔥 Warming cache for clinic: ${clinicId}`);

  try {
    await Promise.allSettled([
      // Import dynamically to avoid circular deps
      import('../admin.cache').then(m => m.getCachedDashboardStats(clinicId)),
      import('../admin.cache').then(m => m.getCachedClinicCounts(clinicId)),
      import('../admin.cache').then(m => m.getCachedServices(clinicId)),
      import('../doctor.cache').then(m => m.getCachedAvailableDoctors(clinicId))
    ]);

    console.log(`✅ Clinic cache warmed: ${clinicId}`);
  } catch (error) {
    console.error(`❌ Clinic cache warming failed: ${clinicId}`, error);
  }
}

/**
 * 🔥 Warm specific growth standards for common ages
 */
export async function warmGrowthStandardsCache() {
  console.log('🔥 Warming growth standards cache...');

  const commonAges = [0, 30, 60, 90, 180, 365, 730, 1095, 1460, 1825]; // days
  const genders = [Gender.MALE, Gender.FEMALE];
  const types = [ChartType.WFA, ChartType.HFA, ChartType.HcFA];

  try {
    const { getCachedGrowthStandardByAge } = await import('../system.cache');

    const warmups = [];
    for (const gender of genders) {
      for (const type of types) {
        for (const age of commonAges) {
          warmups.push(getCachedGrowthStandardByAge(gender, type, age));
        }
      }
    }

    await Promise.allSettled(warmups);
    console.log(`✅ Growth standards cache warmed: ${warmups.length} entries`);
  } catch (error) {
    console.error('❌ Growth standards cache warming failed:', error);
  }
}

/**
 * 🔥 Warm common drug searches
 */
export async function warmDrugSearchCache() {
  console.log('🔥 Warming drug search cache...');

  const commonSearches = ['amoxicillin', 'gentamicin', 'vancomycin', 'furosemide', 'morphine'];

  try {
    const { getCachedDrugSearch } = await import('../system.cache');

    await Promise.all(commonSearches.map(query => getCachedDrugSearch(query)));

    console.log(`✅ Drug search cache warmed: ${commonSearches.length} queries`);
  } catch (error) {
    console.error('❌ Drug search cache warming failed:', error);
  }
}
