import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import App from './App';
import HomePage from './components/HomePage';
import { RoleType } from './types';
import { getDB } from './db';

const SimpleLoginApp: React.FC = () => {
  const { currentUser } = useAuth();
  const [currentPage, setCurrentPage] = useState<'home' | 'login' | 'industry-analysis'>('home');
  const [targetPage, setTargetPage] = useState<'home' | 'industry-analysis'>('home');

  // 按角色计算登录后的初始菜单（替代原先 App 内 700ms 延迟跳转定时器方案，
  // 该方案在 React.StrictMode 下定时器会被清理导致登录后停在首页）
  const getInitialMenu = (role: RoleType, target: 'home' | 'industry-analysis'): string => {
    if (target === 'industry-analysis') return '产业画像';
    switch (role) {
      case RoleType.ADMIN:
        return '专业建设看板';
      case RoleType.PRO_LEAD:
        return '产业画像';
      case RoleType.ORG_ADMIN:
        return '产业画像';
      case RoleType.STUDENT:
        return '典型企业分析';
      case RoleType.ACADEMIC_ADMIN:
        return '专业建设看板';
      case RoleType.INFO_CENTER:
        return '组织架构管理';
      default:
        return '首页';
    }
  };

  // 预初始化本地数据库：在首页阶段就完成 sql.js WASM 加载与建表/写入，
  // 避免首次登录时因初始化耗时/竞态导致"需要二次登录才能成功"
  useEffect(() => {
    getDB().catch(err => console.warn('数据库预加载失败（将在登录时重试）:', err));
  }, []);

  // 默认显示首页（首页包含登录弹窗功能）
  const handleNavigate = (menu: string) => {
    if (menu === '职业仓') {
      setTargetPage('home');
      sessionStorage.setItem('targetPage', 'home');
      setCurrentPage('login');
    } else if (menu === '专业决策与诊断') {
      setTargetPage('home');
      sessionStorage.setItem('targetPage', 'home');
      setCurrentPage('login');
    }
  };

  // 监听页面导航事件
  useEffect(() => {
    const handlePageNavigate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { page } = customEvent.detail;
      if (page === 'home') {
        setCurrentPage('home');
        setTargetPage('home');
      }
    };

    window.addEventListener('pageNavigate', handlePageNavigate);

    return () => {
      window.removeEventListener('pageNavigate', handlePageNavigate);
    };
  }, []);

  // 监听用户登录状态变化
  useEffect(() => {
    if (currentUser) {
      if (targetPage === 'industry-analysis') {
        setCurrentPage('industry-analysis');
      } else {
        setCurrentPage('home');
      }
    }
  }, [currentUser, targetPage]);

  const shouldShowHomePage = !currentUser && currentPage === 'home';
  const shouldShowLoginPage = !currentUser && currentPage === 'login';
  const shouldShowApp = currentUser;

  return (
    <>
      {shouldShowApp && <App initialMenu={getInitialMenu(currentUser, targetPage)} />}
      {shouldShowLoginPage && <Login />}
      {shouldShowHomePage && <HomePage onNavigate={handleNavigate} />}
    </>
  );
};

export default SimpleLoginApp;
