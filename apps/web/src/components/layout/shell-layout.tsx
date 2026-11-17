import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  FileText,
  LayoutDashboard,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  Building2,
  Shield,
  Camera,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { UserAvatar } from '@/components/shared';
import { ProfileAvatarModal } from '@/features/auth/components/profile-avatar-modal';
import { useAuth } from '@/hooks/use-auth';
import { ROLE_LABELS, type Role } from '@/types';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  roles: Role[];
}

const ALL_NAV_ITEMS: NavItem[] = [
  {
    label: 'Visão Geral',
    icon: LayoutDashboard,
    path: '/docente',
    roles: ['PROFESSOR'],
  },
  {
    label: 'Solicitações',
    icon: FileText,
    path: '/solicitacoes',
    roles: ['PROFESSOR'],
  },
  {
    label: 'Gestão de Usuários',
    icon: Users,
    path: '/usuarios',
    roles: ['HEAD'],
  },
];

export function ShellLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const { user, activeRole, hasAnyActiveRole, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Exibe apenas as rotas cujos perfis exigidos estejam vigentes na sessão atual
  const navItems = ALL_NAV_ITEMS.filter((item) => hasAnyActiveRole(item.roles));

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0F382C] text-slate-100 select-none">
      {/* Brand Header */}
      <div
        data-testid="sidebar-brand-header"
        className={cn('flex items-center gap-3 px-4 h-16 border-b border-[#164E3F]', collapsed && 'justify-center px-2')}
      >
        {collapsed ? (
          <span className="text-xs font-bold tracking-tight text-white">UTFPR</span>
        ) : (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold tracking-tight text-white">
              UTFPR
            </span>
            <span className="text-[11px] text-slate-300/70 truncate">Câmpus Cornélio Procópio</span>
          </div>
        )}
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(true)}
            className="ml-auto hidden lg:flex h-7 w-7 text-slate-400 hover:text-white hover:bg-white/10"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {!collapsed && (
          <p className="px-3 pb-2 text-[10px] font-semibold text-emerald-300/60 uppercase tracking-wider">
            Navegação Principal
          </p>
        )}
        <TooltipProvider delay={100}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            const navLinkElement = (
              <NavLink
                to={item.path}
                data-testid={`nav-link-${item.path.replace('/', '')}`}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all group relative',
                  isActive
                    ? 'bg-[#164E3F] text-white shadow-xs font-semibold'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white',
                  collapsed && 'justify-center px-2',
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-emerald-400 rounded-r-full" />
                )}
                <Icon
                  className={cn(
                    'h-5 w-5 shrink-0 transition-transform group-hover:scale-105',
                    isActive ? 'text-emerald-300' : 'text-slate-400 group-hover:text-white',
                  )}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );

            if (!collapsed) {
              return <div key={item.path}>{navLinkElement}</div>;
            }

            return (
              <Tooltip key={item.path}>
                <TooltipTrigger render={navLinkElement} />
                <TooltipContent side="right" className="bg-[#164E3F] text-white border-emerald-600/40 font-medium">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </div>

      {/* Toggle Expand (when collapsed) */}
      {collapsed && (
        <div className="p-2 border-t border-[#164E3F] hidden lg:flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(false)}
            className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Footer: User identification & direct trigger to change profile photo */}
      <div className="p-3 border-t border-[#164E3F] bg-[#0A261E]">
        <button
          type="button"
          data-testid="btn-sidebar-avatar"
          onClick={() => {
            setMobileOpen(false);
            setAvatarModalOpen(true);
          }}
          title="Alterar foto de perfil"
          className={cn(
            'group w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors hover:bg-white/10 focus:outline-hidden cursor-pointer',
            collapsed && 'justify-center p-1',
          )}
        >
          <div className="relative shrink-0">
            <UserAvatar
              name={user?.name}
              avatarUrl={user?.avatarUrl}
              className="h-9 w-9 ring-2 ring-emerald-500/30"
              fallbackClassName="bg-gradient-to-tr from-[#164E3F] to-emerald-600 text-white text-xs"
            />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[#0F382C] ring-2 ring-[#0A261E] opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="h-2.5 w-2.5" />
            </span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.name || 'Usuário'}</p>
              <p className="text-[10px] text-emerald-300/80 flex items-center gap-1 truncate font-medium">
                <Shield className="h-3 w-3 inline shrink-0" />
                {activeRole ? ROLE_LABELS[activeRole] : 'Sem perfil vigente'}
              </p>
            </div>
          )}
        </button>

        {/* Action Logout button */}
        <button
          type="button"
          data-testid="btn-logout"
          onClick={handleLogout}
          className={cn(
            'mt-2 flex items-center gap-2.5 w-full rounded-md px-3 py-2 text-xs font-medium text-rose-300/80 hover:bg-rose-500/10 hover:text-rose-200 transition-colors cursor-pointer',
            collapsed && 'justify-center px-1',
          )}
          title="Sair"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F8FAFC]">
      {/* Desktop Fixed Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col shrink-0 transition-all duration-300 ease-in-out border-r border-[#164E3F]/40 shadow-xl z-30',
          collapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0 border-none">
          <SheetTitle className="sr-only">Menu de Navegação</SheetTitle>
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header Bar styled like modern enterprise templates */}
        <header className="h-16 shrink-0 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shadow-2xs z-20">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-9 w-9 text-slate-700"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#164E3F]" />
              <span className="font-bold text-slate-900 text-sm sm:text-base tracking-tight">
                Plataforma de Gestão de Recursos Financeiros
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* User pill (abre modal de foto de perfil ao clicar) */}
            <button
              type="button"
              data-testid="btn-header-avatar"
              onClick={() => setAvatarModalOpen(true)}
              title="Alterar foto de perfil"
              className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <UserAvatar
                name={user?.name}
                avatarUrl={user?.avatarUrl}
                className="h-8 w-8 ring-1 ring-slate-200"
                fallbackClassName="bg-[#164E3F] text-white text-xs"
              />
              <div className="hidden xl:flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-900 leading-tight">{user?.name}</span>
                <span className="text-[10px] text-slate-500">{user?.email}</span>
              </div>
            </button>
          </div>
        </header>

        {/* Page Main Content with smooth scrolling */}
        <main className="flex-1 overflow-y-auto bg-[#F8FAFC] p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Modal de alteração da foto de perfil */}
      <ProfileAvatarModal
        open={avatarModalOpen}
        onOpenChange={setAvatarModalOpen}
      />
    </div>
  );
}
