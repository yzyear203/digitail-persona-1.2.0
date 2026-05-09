import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Coins, Database, RefreshCcw, X } from 'lucide-react';
import { db } from '../../lib/cloudbase';

function formatNumber(value) {
  return Number(value || 0).toLocaleString('zh-CN');
}

function formatCost(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '未计价';
  const num = Number(value || 0);
  if (num < 0.0001) return `${num.toFixed(8)} 元`;
  if (num < 0.01) return `${num.toFixed(6)} 元`;
  return `${num.toFixed(4)} 元`;
}

function getCreatedAt(item) {
  const raw = item?.createdAt || item?.createTime;
  if (!raw) return 0;
  if (typeof raw === 'number') return raw;
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === 'string') return new Date(raw).getTime() || 0;
  if (raw.$date) return new Date(raw.$date).getTime() || 0;
  return 0;
}

function formatTime(item) {
  const timestamp = getCreatedAt(item);
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleString();
}

function groupByScene(logs) {
  const map = new Map();
  for (const log of logs) {
    const key = log.scene || 'unknown';
    const current = map.get(key) || {
      scene: key,
      count: 0,
      prompt: 0,
      completion: 0,
      total: 0,
      cost: 0,
    };
    current.count += 1;
    current.prompt += Number(log.prompt_tokens || 0);
    current.completion += Number(log.completion_tokens || 0);
    current.total += Number(log.total_tokens || 0);
    current.cost += Number(log.estimated_cost_cny || 0);
    map.set(key, current);
  }
  return Array.from(map.values()).sort((a, b) => b.cost - a.cost || b.total - a.total);
}

function groupByModel(logs) {
  const map = new Map();
  for (const log of logs) {
    const key = `${log.provider || 'unknown'} / ${log.model || 'unknown'}`;
    const current = map.get(key) || {
      model: key,
      count: 0,
      prompt: 0,
      completion: 0,
      total: 0,
      cost: 0,
    };
    current.count += 1;
    current.prompt += Number(log.prompt_tokens || 0);
    current.completion += Number(log.completion_tokens || 0);
    current.total += Number(log.total_tokens || 0);
    current.cost += Number(log.estimated_cost_cny || 0);
    map.set(key, current);
  }
  return Array.from(map.values()).sort((a, b) => b.cost - a.cost || b.total - a.total);
}

export default function CostCockpitModal({ onClose }) {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState('');

  const fetchLogs = async () => {
    setIsLoading(true);
    setErrorText('');
    try {
      if (!db) throw new Error('CloudBase 数据库未初始化');

      let res;
      try {
        res = await db.collection('model_usage_logs')
          .orderBy('createdAt', 'desc')
          .limit(300)
          .get();
      } catch (orderError) {
        console.warn('按 createdAt 排序读取失败，降级为普通读取:', orderError);
        res = await db.collection('model_usage_logs').limit(300).get();
      }

      const rows = (res.data || [])
        .map(item => ({ ...item, id: item._id || item.id }))
        .sort((a, b) => getCreatedAt(b) - getCreatedAt(a));
      setLogs(rows);
    } catch (error) {
      console.error('读取模型用量日志失败:', error);
      setErrorText(error.message || '读取模型用量日志失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const summary = useMemo(() => {
    return logs.reduce((acc, log) => {
      acc.calls += 1;
      acc.prompt += Number(log.prompt_tokens || 0);
      acc.completion += Number(log.completion_tokens || 0);
      acc.total += Number(log.total_tokens || 0);
      acc.cacheHit += Number(log.prompt_cache_hit_tokens || 0);
      acc.cacheMiss += Number(log.prompt_cache_miss_tokens || 0);
      acc.cost += Number(log.estimated_cost_cny || 0);
      if (log.provider === 'deepseek') acc.deepseekCalls += 1;
      if (log.provider === 'doubao') acc.doubaoCalls += 1;
      return acc;
    }, {
      calls: 0,
      deepseekCalls: 0,
      doubaoCalls: 0,
      prompt: 0,
      completion: 0,
      total: 0,
      cacheHit: 0,
      cacheMiss: 0,
      cost: 0,
    });
  }, [logs]);

  const sceneRows = useMemo(() => groupByScene(logs), [logs]);
  const modelRows = useMemo(() => groupByModel(logs), [logs]);
  const cacheRate = summary.prompt > 0 ? summary.cacheHit / summary.prompt : 0;

  return (
    <div className="fixed inset-0 z-[300] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200 flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Coins size={22} className="text-emerald-600" /> 成本驾驶舱
            </h2>
            <p className="text-sm text-slate-500 font-bold mt-1">读取 model_usage_logs，统计最近 300 条模型调用。</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchLogs}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm flex items-center gap-2 disabled:opacity-60"
            >
              <RefreshCcw size={16} className={isLoading ? 'animate-spin' : ''} /> 刷新
            </button>
            <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500">
              <X size={22} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-6 space-y-6">
          {errorText && (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-600">
              {errorText}。如果云数据库权限较严格，请确认当前账号可以读取 model_usage_logs。
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
              <div className="text-xs text-slate-500 font-black mb-1">总调用</div>
              <div className="text-2xl font-black text-slate-900">{formatNumber(summary.calls)}</div>
              <div className="text-xs text-slate-400 mt-1">DeepSeek {summary.deepseekCalls} / Doubao {summary.doubaoCalls}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
              <div className="text-xs text-slate-500 font-black mb-1">总 tokens</div>
              <div className="text-2xl font-black text-slate-900">{formatNumber(summary.total)}</div>
              <div className="text-xs text-slate-400 mt-1">输入 {formatNumber(summary.prompt)} / 输出 {formatNumber(summary.completion)}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
              <div className="text-xs text-slate-500 font-black mb-1">DeepSeek 预估成本</div>
              <div className="text-2xl font-black text-emerald-700">{formatCost(summary.cost)}</div>
              <div className="text-xs text-slate-400 mt-1">豆包仅记录 tokens，暂不计价</div>
            </div>
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
              <div className="text-xs text-slate-500 font-black mb-1">缓存命中率</div>
              <div className="text-2xl font-black text-indigo-700">{(cacheRate * 100).toFixed(1)}%</div>
              <div className="text-xs text-slate-400 mt-1">命中 {formatNumber(summary.cacheHit)} / 未命中 {formatNumber(summary.cacheMiss)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 font-black text-slate-800 flex items-center gap-2">
                <Activity size={18} className="text-indigo-600" /> 按场景统计
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white text-slate-400 text-xs font-black">
                    <tr>
                      <th className="text-left px-4 py-3">场景</th>
                      <th className="text-right px-4 py-3">次数</th>
                      <th className="text-right px-4 py-3">Tokens</th>
                      <th className="text-right px-4 py-3">成本</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sceneRows.map(row => (
                      <tr key={row.scene} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-bold text-slate-700">{row.scene}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-600">{row.count}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-600">{formatNumber(row.total)}</td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-700">{formatCost(row.cost)}</td>
                      </tr>
                    ))}
                    {!sceneRows.length && <tr><td colSpan="4" className="px-4 py-8 text-center text-slate-400 font-bold">暂无数据</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 font-black text-slate-800 flex items-center gap-2">
                <Database size={18} className="text-purple-600" /> 按模型统计
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white text-slate-400 text-xs font-black">
                    <tr>
                      <th className="text-left px-4 py-3">模型</th>
                      <th className="text-right px-4 py-3">次数</th>
                      <th className="text-right px-4 py-3">Tokens</th>
                      <th className="text-right px-4 py-3">成本</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelRows.map(row => (
                      <tr key={row.model} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-bold text-slate-700">{row.model}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-600">{row.count}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-600">{formatNumber(row.total)}</td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-700">{formatCost(row.cost)}</td>
                      </tr>
                    ))}
                    {!modelRows.length && <tr><td colSpan="4" className="px-4 py-8 text-center text-slate-400 font-bold">暂无数据</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 font-black text-slate-800">最近调用明细</div>
            <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white text-slate-400 font-black">
                  <tr>
                    <th className="text-left px-4 py-3">时间</th>
                    <th className="text-left px-4 py-3">场景</th>
                    <th className="text-left px-4 py-3">模型</th>
                    <th className="text-right px-4 py-3">输入</th>
                    <th className="text-right px-4 py-3">输出</th>
                    <th className="text-right px-4 py-3">缓存命中</th>
                    <th className="text-right px-4 py-3">成本</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.slice(0, 80).map((log, index) => (
                    <tr key={log.id || `${log.request_id}_${index}`} className="border-t border-slate-100">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono">{formatTime(log)}</td>
                      <td className="px-4 py-3 font-bold text-slate-700">{log.scene || 'unknown'}</td>
                      <td className="px-4 py-3 text-slate-500">{log.provider}/{log.model}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatNumber(log.prompt_tokens)}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatNumber(log.completion_tokens)}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatNumber(log.prompt_cache_hit_tokens)}</td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-700">{formatCost(log.estimated_cost_cny)}</td>
                    </tr>
                  ))}
                  {!logs.length && <tr><td colSpan="7" className="px-4 py-10 text-center text-slate-400 font-bold">暂无模型用量日志</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
