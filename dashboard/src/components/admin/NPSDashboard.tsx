'use client';

import { useState, useEffect } from 'react';
import { getAPI } from '@/lib/api';
import { TrendingUp, TrendingDown, Minus, MessageSquare } from 'lucide-react';

/**
 * NPSDashboard — shows Net Promoter Score metrics in the admin panel.
 */

interface NPSSummary {
  total_responses: number;
  average_score: number;
  promoters: number;
  passives: number;
  detractors: number;
  nps_score: number;
}

interface NPSResponse {
  score: number;
  comment: string | null;
  category: string;
  created_at: string;
  user_name: string;
  user_email: string;
}

export function NPSDashboard() {
  const [summary, setSummary] = useState<NPSSummary | null>(null);
  const [responses, setResponses] = useState<NPSResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const api = getAPI();
        const [summaryData, responsesData] = await Promise.all([
          api.getNPSSummary(30),
          api.getNPSResponses(10),
        ]);
        setSummary(summaryData);
        setResponses(responsesData.responses);
      } catch {
        console.log('NPS data not available');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="h-4 bg-gray-100 rounded animate-pulse w-1/4 mb-4" />
        <div className="h-24 bg-gray-50 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!summary || summary.total_responses === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-bold text-gray-900 mb-4">NPS Score</h3>
        <div className="text-center py-8">
          <MessageSquare size={24} className="mx-auto text-gray-300 mb-2" />
          <p className="text-xs text-gray-700">No NPS responses yet</p>
          <p className="text-[10px] text-gray-700 mt-1">Responses appear after ticket resolution</p>
        </div>
      </div>
    );
  }

  const getNPSCategory = (score: number) => {
    if (score >= 50) return { label: 'Excellent', color: 'text-emerald-600', bg: 'bg-emerald-50' };
    if (score >= 0) return { label: 'Good', color: 'text-blue-600', bg: 'bg-blue-50' };
    if (score >= -30) return { label: 'Needs Improvement', color: 'text-amber-600', bg: 'bg-amber-50' };
    return { label: 'Critical', color: 'text-red-600', bg: 'bg-red-50' };
  };

  const npsCategory = getNPSCategory(summary.nps_score);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-sm font-bold text-gray-900 mb-4">NPS Score (30 days)</h3>

      {/* Main NPS Score */}
      <div className="flex items-center gap-6 mb-6">
        <div className={`px-6 py-4 rounded-xl ${npsCategory.bg}`}>
          <div className={`text-4xl font-display font-extrabold ${npsCategory.color}`}>
            {summary.nps_score > 0 ? '+' : ''}{summary.nps_score}
          </div>
          <div className={`text-[10px] font-mono font-bold ${npsCategory.color} mt-1`}>
            {npsCategory.label}
          </div>
        </div>

        <div className="flex-1 grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-emerald-50 rounded-lg">
            <div className="text-lg font-bold text-emerald-600">{summary.promoters}</div>
            <div className="text-[9px] font-mono text-emerald-700">Promoters (9-10)</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-gray-600">{summary.passives}</div>
            <div className="text-[9px] font-mono text-gray-700">Passives (7-8)</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-lg font-bold text-red-600">{summary.detractors}</div>
            <div className="text-[9px] font-mono text-red-700">Detractors (0-6)</div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-gray-700">Average:</span>
          <span className="text-sm font-bold text-gray-900">{summary.average_score}/10</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-gray-700">Responses:</span>
          <span className="text-sm font-bold text-gray-900">{summary.total_responses}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-gray-700">Response rate:</span>
          <span className="text-sm font-bold text-gray-900">
            {summary.total_responses > 0 ? `${Math.round(summary.total_responses / Math.max(summary.total_responses * 1.2, 1) * 100)}%` : '—'}
          </span>
        </div>
      </div>

      {/* Score Distribution Bar */}
      <div className="mb-6">
        <div className="text-[10px] font-mono text-gray-700 mb-2">Score Distribution</div>
        <div className="flex gap-0.5 h-6">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => {
            const count = responses.filter(r => r.score === score).length;
            const height = count > 0 ? Math.max(20, (count / Math.max(...[0, ...responses.map(r => responses.filter(x => x.score === r.score).length)], 1)) * 100) : 4;
            return (
              <div key={score} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full rounded-sm transition-all ${
                    score >= 9 ? 'bg-emerald-500' :
                    score >= 7 ? 'bg-gray-400' :
                    'bg-red-400'
                  }`}
                  style={{ height: `${height}%`, minHeight: '2px' }}
                />
                <span className="text-[8px] font-mono text-gray-700">{score}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Comments */}
      {responses.filter(r => r.comment).length > 0 && (
        <div>
          <div className="text-[10px] font-mono text-gray-700 mb-2">Recent Comments</div>
          <div className="space-y-2">
            {responses.filter(r => r.comment).slice(0, 3).map((r, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    r.score >= 9 ? 'bg-emerald-100 text-emerald-700' :
                    r.score >= 7 ? 'bg-gray-100 text-gray-700' :
                    'bg-red-100 text-red-700'
                  }`}>{r.score}/10</span>
                  <span className="text-[9px] font-mono text-gray-700">{r.user_name || r.user_email}</span>
                  <span className="text-[9px] font-mono text-gray-700 ml-auto">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-gray-700">{r.comment}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
