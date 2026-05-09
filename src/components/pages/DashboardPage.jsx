import React, { useRef, useState } from 'react';
import { BarChart3, LogOut, Database, UploadCloud, CheckSquare } from 'lucide-react';
import PersonaCard from '../ui/PersonaCard';
import CostCockpitModal from '../ui/CostCockpitModal';
import { ensurePublicPersona } from '../../lib/publicPersona';

export default function DashboardPage({ userProfile, user, savedPersonas, uploadedFiles, setUploadedFiles, handleStartDistillation, handleDeleteSavedPersona, loadPersonaAndChat, handleLogout }) {
  const fileInputRef = useRef(null);
  const [showCostCockpit, setShowCostCockpit] = useState(false);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const newFiles = await Promise.all(files.map(f => new Promise(resolve => {
      const isImage = f.type.startsWith('image/');
      const isText = f.name.endsWith('.txt') || f.type === 'text/plain';
      if (isImage) {
        const reader = new FileReader();
        reader.onload = event => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            let w = img.width, h = img.height;
            if (w > MAX_WIDTH) { h = Math.round(h * MAX_WIDTH / w); w = MAX_WIDTH; }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve({ name: f.name, type: 'img', size: '已压缩', mimeType: 'image/jpeg', base64Data: canvas.toDataURL('image/jpeg', 0.6).split(',')[1], textContent: null, isImage: true, isText: false });
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(f);
      } else if (isText) {
        const reader = new FileReader();
        reader.onloadend = () => resolve({ name: f.name, type: 'doc', size: (f.size / 1024 / 1024).toFixed(2) + ' MB', mimeType: 'text/plain', base64Data: null, textContent: reader.result, isImage: false, isText: true });
        reader.readAsText(f);
      } else {
        resolve({ name: f.name, warning: true });
      }
    })));
    setUploadedFiles(prev => [...prev, ...newFiles.filter(f => !f.warning)]);
  };

  const handleSharePersona = async (e, persona) => {
    e.stopPropagation();
    try {
      const publicPersona = await ensurePublicPersona({ persona, userProfile, user });
      const shareUrl = `${window.location.origin}${window.location.pathname}?shareId=${publicPersona.id}`;
      await navigator.clipboard.writeText(`我刚刚蒸馏出了数字分身【${publicPersona.name}】，性格极其真实，快来试探一下！\n🔗 链接直达: ${shareUrl}`);
      alert('✅ 公开分享链接已复制！好友将通过隔离后的公开入口访问，不需要开放原始人格档案。');
    } catch (error) {
      console.error('生成公开分享失败:', error);
      alert(`❌ 生成分享失败：${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-6 font-sans">
      <div className="w-full max-w-5xl flex justify-end mb-6">
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl px-5 py-2.5 flex items-center gap-5">
          <button
            onClick={() => setShowCostCockpit(true)}
            className="text-sm font-bold text-slate-500 hover:text-emerald-600 transition-colors flex items-center gap-1.5 border-r border-slate-100 pr-5"
          >
            <BarChart3 size={16}/> 成本驾驶舱
          </button>
          <div className="flex items-center gap-3 border-r border-slate-100 pr-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-lg">{userProfile?.nickname?.charAt(0) || 'U'}</div>
            <div className="flex flex-col">
              <span className="text-sm font-black text-slate-800 leading-tight">{userProfile?.nickname || '加载中...'}</span>
              {userProfile?.shortId && <span className="text-[10px] text-slate-400 font-mono mt-1 bg-slate-50 px-1.5 rounded font-bold">#{userProfile.shortId}</span>}
            </div>
          </div>
          <button onClick={handleLogout} className="text-sm font-bold text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1.5"><LogOut size={16}/> 退出</button>
        </div>
      </div>
      <div className="max-w-3xl w-full">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-black text-slate-800 mb-2">个人数字资产工作台</h1>
          <p className="text-slate-500 font-medium">请上传聊天截图素材，AI 将自动分析其打字韵律与性格</p>
        </div>
        {savedPersonas.length > 0 && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mb-8">
            <div className="p-6 bg-slate-50/50 flex items-center border-b border-slate-100">
              <h2 className="font-black text-slate-800 flex items-center gap-2"><Database size={20} className="text-indigo-600" /> 已存数字人格</h2>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedPersonas.map(p => (
                <PersonaCard 
                  key={p.id} 
                  persona={p} 
                  onClick={() => loadPersonaAndChat(p)} 
                  onDelete={handleDeleteSavedPersona} 
                  onShare={handleSharePersona}
                />
              ))}
            </div>
          </div>
        )}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="p-10 border-b border-slate-100 text-center">
            <h2 className="text-xl font-black text-slate-800 mb-6">注入性格素材</h2>
            <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept=".txt,.jpg,.jpeg,.png" />
            <div onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed rounded-3xl p-12 cursor-pointer transition-all ${uploadedFiles.length > 0 ? 'bg-indigo-50 border-indigo-400' : 'bg-slate-50 border-slate-300 hover:border-indigo-400'}`}>
              {uploadedFiles.length > 0 ? (
                <div className="flex flex-col items-center gap-4">
                  <CheckSquare size={48} className="text-indigo-600" />
                  <div className="flex flex-wrap justify-center gap-2">{uploadedFiles.map((f, i) => <span key={i} className="px-3 py-1 bg-white rounded-lg text-xs font-bold border border-indigo-100 shadow-sm">{f.name}</span>)}</div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <UploadCloud size={56} className="text-slate-300" />
                  <p className="font-bold text-slate-600">点击上传截图或 TXT 文档</p>
                </div>
              )}
            </div>
          </div>
          <div className="p-8 bg-slate-50">
            <button onClick={handleStartDistillation} disabled={uploadedFiles.length === 0} className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-lg rounded-2xl shadow-lg transition-all transform hover:-translate-y-1 disabled:opacity-50">
              开始蒸馏性格特征
            </button>
          </div>
        </div>
      </div>

      {showCostCockpit && <CostCockpitModal onClose={() => setShowCostCockpit(false)} />}
    </div>
  );
}
