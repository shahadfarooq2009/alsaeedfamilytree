import {
  IconGenerations,
  IconGrandchildren,
  IconPerson,
  IconUsers,
} from './referenceTreeIcons';

export interface ReferenceFamilyStatsData {
  total: number;
  generations: number;
  founderChildren: number;
  founderGrandchildren: number;
}

interface ReferenceFamilyStatsProps {
  stats: ReferenceFamilyStatsData;
}

export function ReferenceFamilyStats({ stats }: ReferenceFamilyStatsProps) {
  return (
    <section className="panel">
      <h2 className="panel-head">
        <IconUsers />
        معلومات العائلة
      </h2>
      <div className="stats">
        <div className="stat">
          <IconUsers />
          <span className="stat-label">إجمالي أفراد العائلة</span>
          <span className="stat-value">{stats.total}</span>
        </div>
        <div className="stat">
          <IconGenerations />
          <span className="stat-label">الأجيال</span>
          <span className="stat-value">{stats.generations}</span>
        </div>
        <div className="stat">
          <IconPerson />
          <span className="stat-label">عدد الأبناء</span>
          <span className="stat-value">{stats.founderChildren}</span>
        </div>
        <div className="stat">
          <IconGrandchildren />
          <span className="stat-label">عدد الأحفاد</span>
          <span className="stat-value">{stats.founderGrandchildren}</span>
        </div>
      </div>
    </section>
  );
}
