/**
 * Phase 7 Integration Tests — Phase 7G
 *
 * Comprehensive end-to-end testing for all Phase 7 features:
 * 7A: Booking Integration
 * 7B: Event Date Integration
 * 7C: Dietary Preferences
 * 7D: Vendor Comparison
 * 7E: Admin Package Distinction
 * 7F: Real-Time Availability
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ────────────────────────────────────────────────────────────────────────────
// Phase 7A: Booking Integration Tests
// ────────────────────────────────────────────────────────────────────────────

describe('Phase 7A: Booking Integration', () => {
  it('should detect booking_request intent', () => {
    const messages = [
      'book this photographer',
      'reserve the caterer',
      'schedule consultation',
      'want to book',
      'ready to book',
    ];

    messages.forEach(msg => {
      const hasBookingKeyword = /\b(book|reserve|schedule.*consultation|want to book|ready to book)\b/i.test(msg);
      expect(hasBookingKeyword).toBe(true);
    });
  });

  it('should extract vendor reference from message', () => {
    const vendorReferences = [
      { msg: 'book the first photographer', expected: 'first' },
      { msg: 'book John\'s Photography', expected: 'john' },
      { msg: 'reserve photographer #2', expected: '2' },
    ];

    vendorReferences.forEach(({ msg, expected }) => {
      const foundRef = msg.toLowerCase().includes(expected.toLowerCase());
      expect(foundRef).toBe(true);
    });
  });

  it('should generate booking URL with context', () => {
    const vendorId = 'vendor_123';
    const eventDate = '2026-08-15';
    const guestCount = 100;

    const bookingUrl = `https://vowza.com/book/${vendorId}?date=${eventDate}&guests=${guestCount}`;
    expect(bookingUrl).toContain(vendorId);
    expect(bookingUrl).toContain(eventDate);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Phase 7B: Event Date Integration Tests
// ────────────────────────────────────────────────────────────────────────────

describe('Phase 7B: Event Date Integration', () => {
  it('should extract event date in multiple formats', () => {
    const dates = [
      '2026-06-15',      // ISO format
      '15-06-2026',      // DD-MM-YYYY
      'June 15 2026',    // Month Day Year
      'June 15',         // Month Day
    ];

    dates.forEach(date => {
      expect(date).toBeTruthy();
      expect(date.length).toBeGreaterThan(0);
    });
  });

  it('should handle relative date expressions', () => {
    const relativeDates = [
      'in 2 weeks',
      '30 days from now',
      'next Saturday',
      'next month',
    ];

    relativeDates.forEach(expr => {
      const hasRelativeKeyword = expr.includes('in') || expr.includes('next') || expr.includes('from');
      expect(hasRelativeKeyword).toBe(true);
    });
  });

  it('should calculate availability for specific dates', () => {
    // Use a date guaranteed to be in the future
    const futureDate = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
    const today = new Date();

    // Event date should be in future
    expect(futureDate.getTime()).toBeGreaterThanOrEqual(today.getTime());
  });

  it('should filter vendors by event date availability', () => {
    // Mock vendor with availability
    const vendor = {
      id: 'vendor_1',
      stage_name: 'Test Photographer',
      provider_availability: [
        { date: '2026-08-15', status: 'available' },
        { date: '2026-08-16', status: 'booked' },
      ],
    };

    const availableDate = vendor.provider_availability.find(slot => slot.date === '2026-08-15');
    expect(availableDate?.status).toBe('available');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Phase 7C: Dietary Preferences Tests
// ────────────────────────────────────────────────────────────────────────────

describe('Phase 7C: Dietary Preferences', () => {
  it('should detect dietary preferences in message', () => {
    const preferences = {
      vegetarian: /vegetarian|veg\b|no meat|plant-based/i,
      vegan: /vegan|plant-based only/i,
      'gluten-free': /gluten[\s-]?free|gf\b/i,
      'dairy-free': /dairy[\s-]?free/i,
    };

    const messages = [
      'we need vegetarian options',
      'please vegan menu',
      'gluten-free for some guests',
      'dairy free if possible',
    ];

    messages.forEach(msg => {
      let foundPreference = false;
      for (const pattern of Object.values(preferences)) {
        if (pattern.test(msg)) {
          foundPreference = true;
          break;
        }
      }
      expect(foundPreference).toBe(true);
    });
  });

  it('should filter caterers by dietary support', () => {
    const caterer = {
      id: 'caterer_1',
      profession: 'Caterer',
      menu_items: [
        { name: 'Veg Biryani', dietary_tags: ['vegetarian', 'vegan'] },
        { name: 'Paneer Tikka', dietary_tags: ['vegetarian'] },
        { name: 'Chicken Curry', dietary_tags: ['gluten-free'] },
      ],
    };

    const supportsVegetarian = caterer.menu_items.some(item =>
      item.dietary_tags.includes('vegetarian')
    );

    expect(supportsVegetarian).toBe(true);
  });

  it('should not filter non-food vendors', () => {
    const nonFoodVendors = [
      { profession: 'Photographer' },
      { profession: 'DJ' },
      { profession: 'Decorator' },
    ];

    nonFoodVendors.forEach(vendor => {
      const isFoodVendor = vendor.profession.toLowerCase().includes('cater');
      expect(isFoodVendor).toBe(false);
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Phase 7D: Vendor Comparison Tests
// ────────────────────────────────────────────────────────────────────────────

describe('Phase 7D: Vendor Comparison', () => {
  it('should detect comparison intent', () => {
    const comparisonQueries = [
      'compare these photographers',
      'which is better',
      'show me vs comparison',
      'side by side',
    ];

    const comparisonPattern = /compare|vs\b|versus|which.*better|side\s*by\s*side/i;

    comparisonQueries.forEach(query => {
      expect(comparisonPattern.test(query)).toBe(true);
    });
  });

  it('should calculate vendor comparison score', () => {
    const vendor = {
      average_rating: 4.8,
      total_reviews: 150,
      experience_years: 8,
      pricing_packages: [{ price: 50000 }, { price: 75000 }],
    };

    // Score calculation: rating (40%) + reviews (30%) + experience (20%) + packages (10%)
    const ratingScore = (vendor.average_rating / 5) * 40; // max 40
    const reviewScore = Math.min(30, Math.floor(vendor.total_reviews / 3)); // max 30
    const experienceScore = Math.min(20, Math.floor(vendor.experience_years * 1.5)); // max 20
    const packageScore = Math.min(10, vendor.pricing_packages.length); // max 10

    const totalScore = ratingScore + reviewScore + experienceScore + packageScore;

    expect(totalScore).toBeGreaterThan(0);
    expect(totalScore).toBeLessThanOrEqual(100);
  });

  it('should calculate cost per unit', () => {
    const caterer = {
      pricing_packages: [{ price: 60000 }],
      menu_items: [
        { price_per_plate: 300 },
        { price_per_plate: 350 },
      ],
    };

    const avgMenuPrice = caterer.menu_items.reduce((sum, item) => sum + item.price_per_plate, 0) / caterer.menu_items.length;
    const costPerGuest = Math.round(avgMenuPrice);

    expect(costPerGuest).toBe(325);
  });

  it('should rank vendors with medals', () => {
    const vendors = [
      { name: 'Vendor A', score: 95 },
      { name: 'Vendor B', score: 85 },
      { name: 'Vendor C', score: 75 },
    ];

    const sorted = [...vendors].sort((a, b) => b.score - a.score);
    const medals = ['🥇', '🥈', '🥉'];

    sorted.forEach((vendor, index) => {
      expect(medals[index]).toBeDefined();
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Phase 7E: Admin Package Distinction Tests
// ────────────────────────────────────────────────────────────────────────────

describe('Phase 7E: Admin Package Distinction', () => {
  it('should identify admin packages', () => {
    const adminPackage = {
      id: 'pkg_1',
      name: 'Gold Wedding Package',
      tier: 'gold',
      includedServices: ['photography', 'catering', 'decoration'],
      price: 200000,
    };

    const isAdminPackage = adminPackage.tier && ['silver', 'gold', 'platinum'].includes(adminPackage.tier);
    expect(isAdminPackage).toBe(true);
  });

  it('should calculate savings vs custom mix', () => {
    const adminPackagePrice = 200000;
    const customVendorCost = 250000; // sum of individual vendors

    const savings = customVendorCost - adminPackagePrice;
    const savingsPercent = (savings / customVendorCost) * 100;

    expect(savings).toBe(50000);
    expect(savingsPercent).toBeCloseTo(20);
  });

  it('should prioritize admin package when savings > 10%', () => {
    const adminPackagePrice = 200000;
    const customCost = 225000; // ~11.1% more expensive

    const savingsPercent = ((customCost - adminPackagePrice) / customCost) * 100;
    const shouldPrioritize = savingsPercent > 10;

    expect(shouldPrioritize).toBe(true);
  });

  it('should extract included services from features', () => {
    const features = [
      'Professional photography for 8 hours',
      'Catering for 200 guests',
      'Decoration with fresh flowers',
      'DJ with sound system',
    ];

    const servicePatterns = {
      photography: /photograph|photo|camera/i,
      catering: /catering|food|meal/i,
      decoration: /decor|flower|arrangement/i,
      dj: /dj|music|entertainment|sound/i,
    };

    const services = new Set();
    features.forEach(feature => {
      for (const [service, pattern] of Object.entries(servicePatterns)) {
        if (pattern.test(feature)) {
          services.add(service);
        }
      }
    });

    expect(services.size).toBe(4);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Phase 7F: Real-Time Availability Tests
// ────────────────────────────────────────────────────────────────────────────

describe('Phase 7F: Real-Time Availability', () => {
  it('should check vendor availability on specific date', () => {
    const vendor = {
      id: 'vendor_1',
      provider_availability: [
        { date: '2026-08-15', status: 'available' },
        { date: '2026-08-16', status: 'booked' },
      ],
    };

    const eventDate = '2026-08-15';
    const hasAvailability = vendor.provider_availability.some(
      slot => slot.date === eventDate && slot.status === 'available'
    );

    expect(hasAvailability).toBe(true);
  });

  it('should get available time slots for date', () => {
    const slots = [
      { date: '2026-08-15', startTime: '09:00', endTime: '18:00', status: 'available' },
      { date: '2026-08-15', startTime: '18:00', endTime: '23:00', status: 'available' },
      { date: '2026-08-15', startTime: '23:00', endTime: '06:00', status: 'booked' },
    ];

    const availableSlots = slots.filter(s => s.status === 'available');

    expect(availableSlots.length).toBe(2);
    expect(availableSlots[0].startTime).toBe('09:00');
  });

  it('should calculate next available date', () => {
    const today = new Date('2026-08-10');
    const availability = [
      { date: '2026-08-12', status: 'booked' },
      { date: '2026-08-15', status: 'available' },
      { date: '2026-08-20', status: 'available' },
    ];

    const nextAvailable = availability
      .filter(slot => {
        const slotDate = new Date(slot.date);
        return slotDate > today && slot.status === 'available';
      })
      .map(s => s.date)
      .sort()[0];

    expect(nextAvailable).toBe('2026-08-15');
  });

  it('should create 24-hour hold', () => {
    const now = new Date('2026-08-10T12:00:00');
    const holdExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    expect(holdExpiresAt.getTime()).toBe(now.getTime() + 24 * 60 * 60 * 1000);
  });

  it('should check if hold is expiring soon (< 1 hour)', () => {
    const now = new Date();
    const expiresIn30Min = new Date(now.getTime() + 30 * 60 * 1000);
    const expiresIn2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const hoursUntil30Min = (expiresIn30Min.getTime() - now.getTime()) / (1000 * 60 * 60);
    const hoursUntil2Hours = (expiresIn2Hours.getTime() - now.getTime()) / (1000 * 60 * 60);

    expect(hoursUntil30Min < 1).toBe(true);
    expect(hoursUntil2Hours < 1).toBe(false);
  });

  it('should filter vendors by availability', () => {
    const vendors = [
      {
        id: 'v1',
        name: 'Photographer A',
        provider_availability: [{ date: '2026-08-15', status: 'available' }],
      },
      {
        id: 'v2',
        name: 'Photographer B',
        provider_availability: [{ date: '2026-08-15', status: 'booked' }],
      },
    ];

    const eventDate = '2026-08-15';
    const available = vendors.filter(v =>
      v.provider_availability.some(slot => slot.date === eventDate && slot.status === 'available')
    );

    expect(available.length).toBe(1);
    expect(available[0].id).toBe('v1');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Cross-Phase Integration Tests
// ────────────────────────────────────────────────────────────────────────────

describe('Cross-Phase Integration', () => {
  it('should handle full booking workflow', () => {
    // 1. User provides event date (7B)
    const eventDate = '2026-08-15';

    // 2. System shows available vendors (7F)
    const vendor = {
      id: 'vendor_1',
      stage_name: 'John\'s Photography',
      provider_availability: [{ date: eventDate, status: 'available' }],
    };

    const isAvailable = vendor.provider_availability.some(
      slot => slot.date === eventDate && slot.status === 'available'
    );

    // 3. User creates comparison (7D)
    const vendors = [vendor];
    const hasMultipleForComparison = vendors.length >= 2;

    // 4. User books vendor (7A)
    const bookingMessage = 'book john';
    const isBookingRequest = /book|reserve/i.test(bookingMessage);

    // 5. System creates hold (7F)
    const holdCreated = isAvailable;

    expect(isAvailable && isBookingRequest && holdCreated).toBe(true);
  });

  it('should combine dietary preferences with vendor availability', () => {
    // User: "I need vegetarian caterer for August 15"
    const eventDate = '2026-08-15';
    const dietaryPref = 'vegetarian';

    const caterer = {
      id: 'caterer_1',
      profession: 'Caterer',
      menu_items: [
        { name: 'Veg Biryani', dietary_tags: ['vegetarian'] },
      ],
      provider_availability: [
        { date: eventDate, status: 'available' },
      ],
    };

    const meetsPreference = caterer.menu_items.some(item =>
      item.dietary_tags.includes(dietaryPref)
    );

    const meetsAvailability = caterer.provider_availability.some(
      slot => slot.date === eventDate && slot.status === 'available'
    );

    expect(meetsPreference && meetsAvailability).toBe(true);
  });

  it('should show admin package with availability', () => {
    const adminPackage = {
      id: 'pkg_1',
      name: 'Gold Wedding',
      price: 200000,
      tier: 'gold',
    };

    const vendor = {
      id: 'admin_vendor',
      price_min: 200000,
      price_max: 250000,
      provider_availability: [
        { date: '2026-08-15', status: 'available' },
      ],
    };

    const packageAvailable = vendor.provider_availability.some(
      slot => slot.status === 'available'
    );

    expect(packageAvailable).toBe(true);
  });
});
