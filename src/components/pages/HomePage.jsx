import React from 'react';
import { ShieldCheck, BookOpen, Briefcase, Wand2, ArrowRight } from 'lucide-react';
import AgreementModal from '../ui/AgreementModal';

export default function HomePage({ setAppPhase, showMsg, isAgreed, setIsAgreed, showAgreementModal, setShowAgreementModal, handleAgreeAndProceed }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center pt-20 pb-10 px-6 font-sans">
      <div className="bg-indigo-100 text-indigo-800 px-4 py-2 text-xs flex items-center justify-center space-x-2 rounded-full mb-12 shadow-sm border border-indigo-200">
        <ShieldCheck className="w-4 h-4" />
        <span className="font-bold">2026 合规运作中</span>
        <span>已接入公安部算力备案网络及 PIPL 隐私保护层</span>
      </div>
      <div className="max-w-5xl w-full text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-6">
          Identity as a Skill (IaaS)<br/><span className="text-indigo-600">数字资产编译器</span>
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed font-medium">基于多模态双擎驱动。只需上传对话片段，即刻提取记忆、经验与思考模型，生成具备灵魂的数字分身。</p>
      </div>
      <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-xl transition-all group flex flex-col">
          <div className="bg-amber-100 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><BookOpen className="w-7 h-7 text-amber-600" /></div>
          <h3 className="text-xl font-bold text-slate-800 mb-3">名人人格/思想库</h3>
          <p className="text-sm text-slate-500 mb-8 flex-1 leading-relaxed font-medium">连接公共版权领域的专家、名人思想数据库，进行沉浸式的互动知识学习。</p>
          <button onClick={() => showMsg('提示：【名人库】需要对接公共版权平台 API，当前为演示环境。')} className="w-full py-3.5 rounded-xl font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors">进入版权库</button>
        </div>
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-xl transition-all group flex flex-col">
          <div className="bg-emerald-100 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><Briefcase className="w-7 h-7 text-emerald-600" /></div>
          <h3 className="text-xl font-bold text-slate-800 mb-3">企业工作继任者</h3>
          <p className="text-sm text-slate-500 mb-8 flex-1 leading-relaxed font-medium">对接企业钉钉/飞书组织架构，蒸馏离职员工的隐性思维逻辑与业务 SOP。</p>
          <button onClick={() => showMsg('提示：【企业库】需连接企业内控 OA 系统，当前为演示环境。')} className="w-full py-3.5 rounded-xl font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors">OA 授权登入</button>
        </div>
        <div className="bg-white rounded-3xl p-8 border-2 border-indigo-500 shadow-lg shadow-indigo-100 hover:shadow-2xl transition-all group flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-indigo-500 text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl">推荐体验</div>
          <div className="bg-indigo-100 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><Wand2 className="w-7 h-7 text-indigo-600" /></div>
          <h3 className="text-xl font-bold text-slate-800 mb-3">任意模拟数字人</h3>
          <p className="text-sm text-slate-500 mb-8 flex-1 leading-relaxed font-medium">上传微信截图等素材，通过多模态 AI 一键"蒸馏"性格与记忆，生成数字灵魂。</p>
          <button onClick={() => setShowAgreementModal(true)} className="w-full py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-colors flex justify-center items-center space-x-2">
            <span>立即创建分身</span><ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      {showAgreementModal && (
        <AgreementModal
          isAgreed={isAgreed}
          setIsAgreed={setIsAgreed}
          onCancel={() => { setShowAgreementModal(false); setIsAgreed(false); }}
          onProceed={handleAgreeAndProceed}
        />
      )}
    </div>
  );
}