export const EDUCATION_STAGES = [
    {
        id: 'primary' as const,
        nameEn: 'Primary Stage',
        nameAr: 'المرحلة الابتدائية',
        grades: [1, 2, 3, 4, 5, 6],
        emoji: '🌱',
        description: 'Foundation years — ages 6-12',
        color: 'bg-green-500',
    },
    {
        id: 'preparatory' as const,
        nameEn: 'Preparatory Stage',
        nameAr: 'المرحلة الإعدادية',
        grades: [1, 2, 3],
        emoji: '📚',
        description: 'Middle school — ages 12-15',
        color: 'bg-blue-500',
    },
    {
        id: 'secondary' as const,
        nameEn: 'Secondary Stage',
        nameAr: 'المرحلة الثانوية',
        grades: [1, 2, 3],
        emoji: '🎓',
        description: 'High school — ages 15-18',
        color: 'bg-yellow-500',
    },
] as const;

export type EducationStageId = (typeof EDUCATION_STAGES)[number]['id'];

export function getOrdinalGradeAr(grade: number): string {
    const ordinals = [
        'الأول',
        'الثاني',
        'الثالث',
        'الرابع',
        'الخامس',
        'السادس',
    ];
    return ordinals[grade - 1] || `${grade}`;
}
