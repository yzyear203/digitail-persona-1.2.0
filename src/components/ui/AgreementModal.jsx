import React from 'react';
import { Scale, AlertTriangle, FileSignature } from 'lucide-react';

export default function AgreementModal({ isAgreed, setIsAgreed, onCancel, onProceed }) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center space-x-3 mb-6 border-b border-slate-100 pb-5">
          <div className="bg-slate-100 p-3 rounded-full"><Scale className="w-6 h-6 text-slate-700" /></div>
          <h2 className="text-2xl font-bold text-slate-800">数字人提取授权协议</h2>
        </div>
        <div className="flex-1 overflow-y-auto pr-4 space-y-4 text-sm text-slate-600 leading-relaxed mb-8 font-medium">
          <p>尊敬的用户，在继续操作前，请您务必仔细阅读：</p>
          <div className="bg-amber-50 border border-amber-200 p-5 rounded-xl text-amber-800">
            <h4 className="flex items-center mb-2 font-bold"><AlertTriangle className="w-4 h-4 mr-2"/> 知情同意声明</h4>
            <p className="text-xs leading-relaxed">本平台仅提供 AI 算力与算法服务。您上传他人发言、截图等数据时，<strong>必须已事先征得被提取者本人的明确同意。</strong></p>
          </div>
        </div>
        <div>
          <label className="flex items-start space-x-3 cursor-pointer mb-6">
            <input type="checkbox" checked={isAgreed} onChange={e => setIsAgreed(e.target.checked)} className="mt-0.5 w-5 h-5 rounded border-slate-300 text-indigo-600 cursor-pointer"/>
            <span className="text-sm font-bold text-slate-700 select-none">我已阅读并同意，承诺已获得合法授权。</span>
          </label>
          <div className="flex space-x-4">
            <button onClick={onCancel} className="flex-1 py-3.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">取消</button>
            <button onClick={onProceed} disabled={!isAgreed} className="flex-1 py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 flex justify-center items-center gap-2 shadow-md">
              <FileSignature className="w-5 h-5"/><span>同意并进入</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}