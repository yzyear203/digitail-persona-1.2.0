import React from 'react';
import { AlertTriangle, CheckSquare } from 'lucide-react';

export default function ErrorPage({ error }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-xl w-full text-center border-t-4 border-red-500">
        <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-black text-slate-800 mb-4">系统白屏预警拦截</h1>
        <div className="bg-slate-900 p-4 rounded-xl text-left text-xs font-mono text-emerald-400 mb-8 overflow-auto break-all">
          &gt; {error}
        </div>
        <div className="text-left bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
          <h3 className="font-bold text-indigo-800 mb-3 flex items-center gap-2"><CheckSquare className="w-5 h-5"/> Vercel 部署自救指南</h3>
          <ul className="text-sm text-indigo-700 space-y-3 font-medium">
            <li>1. Vercel 控制台 → Settings → Environment Variables</li>
            <li>2. 添加 <code className="bg-white px-1.5 py-0.5 rounded border border-indigo-100 font-bold">VITE_TCB_ENV_ID</code>，填入腾讯云环境 ID</li>
            <li>3. Deployments 页面点击 <b>Redeploy</b> 重新部署</li>
          </ul>
        </div>
      </div>
    </div>
  );
}