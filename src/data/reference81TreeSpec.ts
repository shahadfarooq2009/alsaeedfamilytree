/** Reference demo tree: founder + 4 branches × 11 descendants (initial view). */

export const REFERENCE_81_TOTAL = 81;

export const REFERENCE_81_COUNTS = {
  /** Each of the 4 founder children has 11 direct descendants shown in forest panels. */
  gen3PerGen2: [11, 11, 11, 11],
  /** 16 of the 44 gen-3 members have 2 children each (32 gen-4) to reach 81 total. */
  gen4PerGen3: [
    2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  gen5PerGen4: [] as const,
  gen6PerGen5: [] as const,
} as const;

export const REFERENCE_81_BRANCH_NAMES = ['محمد', 'أحمد', 'عبدالله', 'سعود'] as const;

export const REFERENCE_81_NAME_POOL = [
  'ابراهيم', 'سارة', 'علي', 'فاطمة', 'حسن', 'مريم', 'خالد', 'نورة',
  'سعود', 'ريم', 'فهد', 'هدى', 'عمر', 'لينا', 'يوسف', 'دانة',
  'طارق', 'سلمى', 'بدر', 'جنى', 'وليد', 'منال', 'راشد', 'نهى',
  'سالم', 'ليلى', 'ماجد', 'زهراء', 'حمد', 'ابتسام', 'نواف', 'شهد',
  'جلال', 'آمنة', 'كريم', 'غادة', 'زياد', 'هيفاء', 'منصور', 'سمية',
  'بلال', 'رقية', 'طلال', 'جميلة', 'عبدالرحمن', 'لطيفة', 'محمود', 'حنان',
  'شريفة', 'حسين', 'خديجة', 'جاسم', 'ابتهال', 'ناصر', 'فوزية', 'سعد',
  'مها', 'فيصل', 'روان', 'عادل', 'تالا', 'مروان', 'بندر', 'لمى',
  'رنا', 'حاتم', 'ديمة', 'سامي', 'الاء', 'وسام', 'ندى', 'رامي',
  'هناء', 'قيس', 'مها', 'زيد', 'لمياء', 'سهام', 'عبدالله', 'منى',
] as const;
