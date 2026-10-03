import { matchMuglaDistrict, matchMuglaDistrictFromFields, filterPharmaciesByDistrict, nearestPharmacyDistrict, nearestDistrictByCoords, resolveMuglaDistrict, matchProvince, resolveLocationPlace } from './turkeyAddressService';

describe('matchMuglaDistrict', () => {
  test('maps merkez to Menteşe', () => {
    expect(matchMuglaDistrict('Merkez')).toBe('Menteşe');
  });

  test('matches Fethiye ignoring case', () => {
    expect(matchMuglaDistrict('FETHİYE')).toBe('Fethiye');
  });

  test('does not treat Muğla as Ula', () => {
    expect(matchMuglaDistrict('Muğla')).toBe('');
  });

  test('strips ilçe suffix', () => {
    expect(matchMuglaDistrict('Fethiye İlçesi')).toBe('Fethiye');
  });

  test('keeps short district Ula', () => {
    expect(matchMuglaDistrict('Ula')).toBe('Ula');
  });
});

describe('nearestPharmacyDistrict', () => {
  test('picks closest pharmacy district', () => {
    const list = [
      { district: 'BODRUM', location: { latitude: 37.03, longitude: 27.43 } },
      { district: 'FETHİYE', location: { latitude: 36.62, longitude: 29.11 } },
    ];
    expect(nearestPharmacyDistrict(list, { latitude: 36.64, longitude: 29.12 })).toBe('Fethiye');
  });
});

describe('matchMuglaDistrictFromFields', () => {
  test('finds district among mixed fields', () => {
    expect(matchMuglaDistrictFromFields(['Muğla', 'Ölüdeniz', 'Fethiye İlçesi'])).toBe('Fethiye');
  });

  test('maps Ölüdeniz to Fethiye', () => {
    expect(matchMuglaDistrict('Ölüdeniz')).toBe('Fethiye');
  });
});

describe('nearestDistrictByCoords', () => {
  test('Fethiye center resolves to Fethiye', () => {
    expect(nearestDistrictByCoords({ latitude: 36.66, longitude: 29.13 })).toBe('Fethiye');
  });

  test('Istanbul does not resolve', () => {
    expect(nearestDistrictByCoords({ latitude: 41.01, longitude: 28.97 })).toBe('');
  });
});

describe('resolveMuglaDistrict', () => {
  test('uses coords when names are only Muğla', () => {
    expect(resolveMuglaDistrict({
      coords: { latitude: 36.66, longitude: 29.13 },
      fields: ['Muğla'],
      pharmacies: [],
    })).toBe('Fethiye');
  });
});

describe('matchProvince', () => {
  test('matches İstanbul variants', () => {
    expect(matchProvince('İstanbul')).toBe('İstanbul');
    expect(matchProvince('Istanbul')).toBe('İstanbul');
    expect(matchProvince('İstanbul ili')).toBe('İstanbul');
  });
});

describe('resolveLocationPlace', () => {
  test('uses Muğla district when coords are in Muğla', () => {
    expect(resolveLocationPlace({
      coords: { latitude: 36.66, longitude: 29.13 },
      fields: ['Muğla'],
    })).toEqual({ city: 'Muğla', district: 'Fethiye' });
  });

  test('finds İstanbul and Kadıköy from address fields', () => {
    expect(resolveLocationPlace({
      coords: { latitude: 40.99, longitude: 29.03 },
      fields: ['Kadıköy', 'İstanbul', 'Türkiye'],
    })).toEqual({ city: 'İstanbul', district: 'Kadıköy' });
  });
});

describe('filterPharmaciesByDistrict', () => {
  const list = [
    { name: 'A', district: 'FETHİYE' },
    { name: 'B', district: 'BODRUM' },
    { name: 'C', district: 'MERKEZ' },
  ];

  test('returns all when district empty', () => {
    expect(filterPharmaciesByDistrict(list, '').map((p) => p.name)).toEqual(['A', 'B', 'C']);
  });

  test('keeps Fethiye only', () => {
    expect(filterPharmaciesByDistrict(list, 'Fethiye').map((p) => p.name)).toEqual(['A']);
  });

  test('maps Menteşe to MERKEZ', () => {
    expect(filterPharmaciesByDistrict(list, 'Menteşe').map((p) => p.name)).toEqual(['C']);
  });
});
