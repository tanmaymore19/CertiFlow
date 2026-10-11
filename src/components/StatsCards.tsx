import React from 'react';
import { Layers, Users, Award, CheckCircle, Clock } from 'lucide-react';
import { CertificateProject } from '../types/certificate';

interface StatsCardsProps {
  projects: CertificateProject[];
}

export const StatsCards: React.FC<StatsCardsProps> = ({ projects }) => {
  const totalProjects = projects.length;
  const totalRecipients = projects.reduce((acc, p) => acc + (p.recipientCount || p.recipients?.length || 0), 0);
  const totalGenerated = projects.reduce((acc, p) => acc + (p.generatedCount || 0), 0);
  const totalFailed = projects.reduce((acc, p) => acc + (p.failedCount || 0), 0);
  const completedProjects = projects.filter((p) => p.status === 'completed').length;

  const stats = [
    {
      label: 'Certificate Projects',
      value: totalProjects,
      subtext: `${completedProjects} completed projects`,
      icon: Layers,
      iconColor: 'text-indigo-600',
      bgLight: 'bg-indigo-50 border-indigo-100',
    },
    {
      label: 'Recipients Processed',
      value: totalRecipients,
      subtext: 'Across all uploaded batches',
      icon: Users,
      iconColor: 'text-sky-600',
      bgLight: 'bg-sky-50 border-sky-100',
    },
    {
      label: 'Certificates Generated',
      value: totalGenerated,
      subtext: totalFailed > 0 ? `${totalFailed} failed records` : '100% vector PDF quality',
      icon: Award,
      iconColor: 'text-amber-600',
      bgLight: 'bg-amber-50 border-amber-100',
    },
    {
      label: 'Generation Health',
      value: totalRecipients > 0 ? `${Math.round(((totalGenerated) / Math.max(1, totalGenerated + totalFailed)) * 100)}%` : 'Ready',
      subtext: totalProjects === 0 ? 'Start your first batch' : 'Active system ready',
      icon: totalRecipients > 0 ? CheckCircle : Clock,
      iconColor: 'text-emerald-600',
      bgLight: 'bg-emerald-50 border-emerald-100',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div
            key={idx}
            className="p-5 bg-white rounded-xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow duration-200 flex items-start justify-between"
          >
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{item.label}</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{item.value}</h3>
              <p className="text-xs text-slate-500 mt-1">{item.subtext}</p>
            </div>
            <div className={`p-2.5 rounded-xl border ${item.bgLight}`}>
              <Icon className={`w-5 h-5 ${item.iconColor}`} />
            </div>
          </div>
        );
      })}
    </div>
  );
};
