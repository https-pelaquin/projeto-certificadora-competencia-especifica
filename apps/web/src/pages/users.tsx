import { useState, useMemo, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  UserPlus,
  Mail,
  ShieldCheck,
  ShieldOff,
  ShieldPlus,
  UserX,
  AlertTriangle,
  Users as UsersIcon,
  Search,
  Loader2,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { EmptyState, TableSkeleton, ConfirmDialog } from '@/components/shared';
import {
  useAssignProfile,
  useDeactivateUser,
  useEndProfileTenure,
  useInviteUser,
  useUsers,
} from '@/features/users/api';
import {
  createAssignProfileSchema,
  createInviteUserSchema,
  type AssignProfileFormData,
  type InviteUserFormData,
} from '@/schemas';
import { isTenureActive } from '@/lib/auth-rules';
import { formatDate } from '@/lib/utils';
import { ROLE_LABELS, type Role, type ProfileTenure, type User } from '@/types';

type UserStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

export function UsersPage() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [assignTargetUser, setAssignTargetUser] = useState<User | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null);
  const [searchUser, setSearchUser] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>('ALL');
  const [endTenureTarget, setEndTenureTarget] = useState<{
    user: User;
    profile: ProfileTenure;
  } | null>(null);

  const { data: usersResponse, isLoading, isError } = useUsers();
  const inviteMutation = useInviteUser();
  const assignProfileMutation = useAssignProfile();
  const deactivateMutation = useDeactivateUser();
  const endTenureMutation = useEndProfileTenure();

  const users = useMemo(
    () => usersResponse?.data ?? [],
    [usersResponse?.data],
  );

  // Chefe de departamento com mandato vigente ativo (active === true e vigência dentro da janela)
  const currentActiveHead = useMemo(() => {
    for (const u of users) {
      if (!u.active) continue;
      const activeHeadProfile = u.profiles.find(
        (p) => p.role === 'HEAD' && isTenureActive(p),
      );
      if (activeHeadProfile) {
        return { user: u, profile: activeHeadProfile };
      }
    }
    return null;
  }, [users]);

  const hasActiveHead = Boolean(currentActiveHead);

  const inviteSchema = useMemo(
    () => createInviteUserSchema(hasActiveHead),
    [hasActiveHead],
  );

  const assignSchema = useMemo(
    () => createAssignProfileSchema(hasActiveHead),
    [hasActiveHead],
  );

  const inviteForm = useForm<InviteUserFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'PROFESSOR',
      startsAt: new Date().toISOString().split('T')[0],
      endsAt: '',
    },
  });

  const assignForm = useForm<AssignProfileFormData>({
    resolver: zodResolver(assignSchema),
    defaultValues: {
      role: 'PROFESSOR',
      startsAt: new Date().toISOString().split('T')[0],
      endsAt: '',
    },
  });

  useEffect(() => {
    if (assignTargetUser) {
      assignProfileMutation.reset();
      assignForm.reset({
        role: 'PROFESSOR',
        startsAt: new Date().toISOString().split('T')[0],
        endsAt: '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignTargetUser]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(searchUser.toLowerCase()) ||
        u.email.toLowerCase().includes(searchUser.toLowerCase());
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && u.active) ||
        (statusFilter === 'INACTIVE' && !u.active);
      return matchesSearch && matchesStatus;
    });
  }, [users, searchUser, statusFilter]);

  const onInviteSubmit = async (data: InviteUserFormData) => {
    await inviteMutation.mutateAsync({
      name: data.name,
      email: data.email,
      role: data.role,
      startsAt: new Date(`${data.startsAt}T00:00:00Z`).toISOString(),
      endsAt: data.endsAt
        ? new Date(`${data.endsAt}T23:59:59Z`).toISOString()
        : null,
    });
    setInviteOpen(false);
    inviteForm.reset();
  };

  const onAssignProfileSubmit = async (data: AssignProfileFormData) => {
    if (!assignTargetUser) return;
    await assignProfileMutation.mutateAsync({
      userId: assignTargetUser.id,
      role: data.role,
      startsAt: new Date(`${data.startsAt}T00:00:00Z`).toISOString(),
      endsAt: data.endsAt
        ? new Date(`${data.endsAt}T23:59:59Z`).toISOString()
        : null,
    });
    setAssignTargetUser(null);
  };

  return (
    <div className="space-y-6" data-testid="users-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Gestão de Usuários e Mandatos
            </h1>
            <span className="text-xs bg-emerald-100 text-[#164E3F] font-bold px-2 py-0.5 rounded-full border border-emerald-300">
              Chefia DACOM
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Controle de usuários ativos/inativos, atribuição de perfis e vigências (início e término)
          </p>
        </div>

        <Button
          data-testid="btn-invite-user"
          onClick={() => {
            inviteMutation.reset();
            inviteForm.reset({
              name: '',
              email: '',
              role: 'PROFESSOR',
              startsAt: new Date().toISOString().split('T')[0],
              endsAt: '',
            });
            setInviteOpen(true);
          }}
          className="bg-[#164E3F] hover:bg-[#0F382C] text-white shadow-sm font-semibold gap-2 h-10 px-4 self-start sm:self-auto cursor-pointer"
        >
          <UserPlus className="h-4 w-4" />
          Convidar Usuário
        </Button>
      </div>

      {/* Alerta de Vigência de Chefia (Garantia visual de não-sobreposição) */}
      <Card
        data-testid="active-head-banner"
        className="border-emerald-200 bg-gradient-to-r from-emerald-50/70 to-slate-50 shadow-2xs rounded-2xl"
      >
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-600 text-white shrink-0 mt-0.5">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">
                Chefe de Departamento Atualmente em Exercício
              </p>
              {currentActiveHead ? (
                <p className="text-xs text-slate-600 mt-0.5">
                  <span className="font-semibold text-[#164E3F]">{currentActiveHead.user.name}</span>{' '}
                  ({currentActiveHead.user.email}) — Vigência: {formatDate(currentActiveHead.profile.startsAt)}{' '}
                  {currentActiveHead.profile.endsAt
                    ? `até ${formatDate(currentActiveHead.profile.endsAt)}`
                    : '• sem termo final'}
                </p>
              ) : (
                <p className="text-xs text-amber-700 font-medium">
                  Nenhum chefe com mandato vigente ativo no momento. É possível atribuir um novo titular HEAD.
                </p>
              )}
            </div>
          </div>

          {currentActiveHead && (
            <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs py-1 px-3 self-start sm:self-auto">
              Mandato Vigente • Titular Único
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Tabela de Usuários */}
      <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                data-testid="input-search-users"
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                placeholder="Buscar por nome ou e-mail institucional..."
                className="pl-9 h-9 text-xs bg-slate-50/80 border-slate-200"
              />
            </div>

            <Select
              value={statusFilter}
              onValueChange={(val) => setStatusFilter((val as UserStatusFilter) ?? 'ALL')}
            >
              <SelectTrigger
                data-testid="select-filter-user-status"
                className="h-9 text-xs w-[160px] bg-white border-slate-200"
              >
                <SelectValue>
                  {(val: string | null) =>
                    val === 'ACTIVE'
                      ? 'Apenas Ativos'
                      : val === 'INACTIVE'
                        ? 'Apenas Inativos'
                        : 'Todos os Usuários'
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">Todos os Usuários</SelectItem>
                <SelectItem value="ACTIVE" className="text-xs">Apenas Ativos</SelectItem>
                <SelectItem value="INACTIVE" className="text-xs">Apenas Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <span className="text-xs text-slate-500 font-medium">
            Total: {filteredUsers.length} usuário(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <TableSkeleton rows={5} columns={5} />
          ) : isError ? (
            <div className="p-8 text-center">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-800">Falha ao carregar lista de usuários</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<UsersIcon className="h-8 w-8 text-slate-400" />}
                title="Nenhum usuário encontrado"
                description="Não há usuários cadastrados correspondentes à busca ou filtro selecionado."
              />
            </div>
          ) : (
            <Table data-testid="users-table">
              <TableHeader>
                <TableRow className="bg-slate-50/70 border-b border-slate-200 text-slate-600">
                  <TableHead className="text-xs font-bold pl-6">Nome Completo</TableHead>
                  <TableHead className="text-xs font-bold">E-mail Institucional</TableHead>
                  <TableHead className="text-xs font-bold">Status</TableHead>
                  <TableHead className="text-xs font-bold">Perfis e Vigências (startsAt / endsAt)</TableHead>
                  <TableHead className="text-xs font-bold text-right pr-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow
                    key={user.id}
                    data-testid={`user-row-${user.id}`}
                    className="hover:bg-slate-50/80 transition-colors border-b border-slate-100"
                  >
                    <TableCell className="pl-6 font-semibold text-xs text-slate-900">
                      {user.name}
                    </TableCell>

                    <TableCell className="text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1.5 font-mono">
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                        {user.email}
                      </span>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant="outline"
                        data-testid={`user-status-${user.active ? 'active' : 'inactive'}`}
                        className={
                          user.active
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 text-[11px]'
                            : 'bg-slate-100 text-slate-500 border-slate-200 text-[11px]'
                        }
                      >
                        {user.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {user.profiles.map((p) => {
                          const vigente = user.active && isTenureActive(p);
                          return (
                            <div
                              key={p.id}
                              data-testid={`profile-tenure-${p.role}`}
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] ${
                                !vigente
                                  ? 'bg-slate-100 text-slate-500 border-slate-200'
                                  : p.role === 'HEAD'
                                    ? 'bg-purple-50 text-purple-800 border-purple-200 font-semibold'
                                    : p.role === 'COUNCIL_MEMBER'
                                      ? 'bg-blue-50 text-blue-800 border-blue-200 font-medium'
                                      : 'bg-emerald-50/60 text-emerald-900 border-emerald-200'
                              }`}
                            >
                              <span>{ROLE_LABELS[p.role]}</span>
                              <span className="text-[10px] opacity-80">
                                ({formatDate(p.startsAt)}{' '}
                                {p.endsAt ? `até ${formatDate(p.endsAt)}` : '• vigente'})
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </TableCell>

                    <TableCell className="text-right pr-6">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!user.active}
                          data-testid={`btn-assign-profile-${user.id}`}
                          onClick={() => setAssignTargetUser(user)}
                          className="h-8 text-xs text-[#164E3F] hover:text-[#0F382C] hover:bg-emerald-50 gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          title={
                            user.active
                              ? 'Atribuir novo perfil com vigência'
                              : 'Usuário inativo não pode receber novos perfis'
                          }
                        >
                          <ShieldPlus className="h-3.5 w-3.5" />
                          Atribuir Perfil
                        </Button>

                        {user.active &&
                          user.profiles
                            .filter((p) => isTenureActive(p) && p.role !== 'PROFESSOR')
                            .map((p) => (
                              <Button
                                key={p.id}
                                variant="ghost"
                                size="sm"
                                data-testid={`btn-end-tenure-${p.id}`}
                                onClick={() => setEndTenureTarget({ user, profile: p })}
                                className="h-8 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50 gap-1 cursor-pointer"
                                title={`Encerrar mandato de ${ROLE_LABELS[p.role]}`}
                              >
                                <ShieldOff className="h-3.5 w-3.5" />
                                Encerrar {ROLE_LABELS[p.role]}
                              </Button>
                            ))}

                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!user.active}
                          data-testid={`btn-deactivate-user-${user.id}`}
                          onClick={() => setDeactivateTarget(user)}
                          className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          title={
                            user.active
                              ? 'Desativar usuário (active = false, sem exclusão)'
                              : 'Usuário já desativado'
                          }
                        >
                          <UserX className="h-3.5 w-3.5" />
                          Desativar Usuário
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>

      {/* Modal Convidar Novo Usuário */}
      <Dialog open={inviteOpen} onOpenChange={(open) => !inviteMutation.isPending && setInviteOpen(open)}>
        <DialogContent data-testid="modal-invite-user" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Convidar Novo Usuário
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Cadastre um usuário institucional e configure a vigência do perfil inicial
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={inviteForm.handleSubmit(onInviteSubmit)} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="inv-name" className="text-xs font-semibold text-slate-700">
                Nome Completo *
              </Label>
              <Input
                id="inv-name"
                data-testid="input-invite-name"
                placeholder="Ex: Prof. Dr. André Silva"
                className="bg-slate-50"
                {...inviteForm.register('name')}
              />
              {inviteForm.formState.errors.name && (
                <p className="text-xs text-red-500">{inviteForm.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inv-email" className="text-xs font-semibold text-slate-700">
                E-mail Institucional (@utfpr.edu.br) *
              </Label>
              <Input
                id="inv-email"
                data-testid="input-invite-email"
                type="email"
                placeholder="andresilva@utfpr.edu.br"
                className="bg-slate-50"
                {...inviteForm.register('email')}
              />
              {inviteForm.formState.errors.email && (
                <p className="text-xs text-red-500">{inviteForm.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Perfil Inicial *</Label>
              <Controller
                name="role"
                control={inviteForm.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(val) => val && field.onChange(val as Role)}>
                    <SelectTrigger data-testid="select-invite-role" className="w-full bg-slate-50">
                      <SelectValue>
                        {(val: string | null) =>
                          val ? ROLE_LABELS[val as Role] ?? val : 'Selecione o papel'
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([k, label]) => {
                        const isHeadDisabled = k === 'HEAD' && hasActiveHead;
                        return (
                          <SelectItem
                            key={k}
                            value={k}
                            disabled={isHeadDisabled}
                            data-testid={`select-invite-role-option-${k}`}
                            className="text-xs"
                          >
                            {isHeadDisabled ? `${label} (Bloqueado: mandato vigente)` : label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              />
              {inviteForm.formState.errors.role && (
                <p className="text-xs text-red-500">{inviteForm.formState.errors.role.message}</p>
              )}

              {hasActiveHead && currentActiveHead && (
                <div
                  data-testid="alert-head-already-active"
                  className="p-3 mt-2 rounded-xl bg-amber-50 border border-amber-300 flex items-start gap-2.5"
                >
                  <Lock className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900">
                    <p className="font-bold">Seleção de Chefia (HEAD) bloqueada</p>
                    <p className="mt-0.5 text-amber-800">
                      O docente <span className="font-semibold">{currentActiveHead.user.name}</span> já possui mandato
                      HEAD vigente. Encerre o mandato atual antes de atribuir uma nova chefia.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="inv-starts-at" className="text-xs font-semibold text-slate-700">
                  Início da Vigência (startsAt) *
                </Label>
                <Input
                  id="inv-starts-at"
                  data-testid="input-invite-starts-at"
                  type="date"
                  className="bg-slate-50"
                  {...inviteForm.register('startsAt')}
                />
                {inviteForm.formState.errors.startsAt && (
                  <p className="text-xs text-red-500">{inviteForm.formState.errors.startsAt.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inv-ends-at" className="text-xs font-semibold text-slate-700">
                  Fim da Vigência (endsAt)
                </Label>
                <Input
                  id="inv-ends-at"
                  data-testid="input-invite-ends-at"
                  type="date"
                  className="bg-slate-50"
                  {...inviteForm.register('endsAt')}
                />
                {inviteForm.formState.errors.endsAt && (
                  <p className="text-xs text-red-500">{inviteForm.formState.errors.endsAt.message}</p>
                )}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteOpen(false)}
                disabled={inviteMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                data-testid="btn-submit-invite"
                disabled={inviteMutation.isPending}
                className="bg-[#164E3F] hover:bg-[#0F382C] text-white"
              >
                {inviteMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando convite...
                  </>
                ) : (
                  'Enviar Convite'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Atribuir Perfil a Usuário Existente */}
      <Dialog
        open={Boolean(assignTargetUser)}
        onOpenChange={(open) => {
          if (!open && !assignProfileMutation.isPending) {
            setAssignTargetUser(null);
          }
        }}
      >
        <DialogContent data-testid="modal-assign-profile" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Atribuir Novo Perfil
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Adicione um perfil e sua respectiva janela de vigência para{' '}
              <span className="font-semibold text-slate-700">{assignTargetUser?.name}</span>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={assignForm.handleSubmit(onAssignProfileSubmit)} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Perfil *</Label>
              <Controller
                name="role"
                control={assignForm.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(val) => val && field.onChange(val as Role)}>
                    <SelectTrigger data-testid="select-assign-role" className="w-full bg-slate-50">
                      <SelectValue>
                        {(val: string | null) =>
                          val ? ROLE_LABELS[val as Role] ?? val : 'Selecione o papel'
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([k, label]) => {
                        const isHeadDisabled = k === 'HEAD' && hasActiveHead;
                        return (
                          <SelectItem
                            key={k}
                            value={k}
                            disabled={isHeadDisabled}
                            data-testid={`select-assign-role-option-${k}`}
                            className="text-xs"
                          >
                            {isHeadDisabled ? `${label} (Bloqueado: chefe vigente)` : label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              />
              {assignForm.formState.errors.role && (
                <p className="text-xs text-red-500">{assignForm.formState.errors.role.message}</p>
              )}

              {hasActiveHead && currentActiveHead && (
                <div
                  data-testid="alert-assign-head-blocked"
                  className="p-3 mt-2 rounded-xl bg-amber-50 border border-amber-300 flex items-start gap-2.5"
                >
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900">
                    <p className="font-bold">Papel HEAD indisponível</p>
                    <p className="mt-0.5 text-amber-800">
                      Já existe chefe com mandato vigente ({currentActiveHead.user.name}). Encerre a vigência atual
                      para liberar a atribuição de Chefia.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="assign-starts-at" className="text-xs font-semibold text-slate-700">
                  Início (startsAt) *
                </Label>
                <Input
                  id="assign-starts-at"
                  data-testid="input-assign-starts-at"
                  type="date"
                  className="bg-slate-50"
                  {...assignForm.register('startsAt')}
                />
                {assignForm.formState.errors.startsAt && (
                  <p className="text-xs text-red-500">{assignForm.formState.errors.startsAt.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="assign-ends-at" className="text-xs font-semibold text-slate-700">
                  Término (endsAt)
                </Label>
                <Input
                  id="assign-ends-at"
                  data-testid="input-assign-ends-at"
                  type="date"
                  className="bg-slate-50"
                  {...assignForm.register('endsAt')}
                />
                {assignForm.formState.errors.endsAt && (
                  <p className="text-xs text-red-500">{assignForm.formState.errors.endsAt.message}</p>
                )}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAssignTargetUser(null)}
                disabled={assignProfileMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                data-testid="btn-submit-assign-profile"
                disabled={assignProfileMutation.isPending}
                className="bg-[#164E3F] hover:bg-[#0F382C] text-white"
              >
                {assignProfileMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Atribuindo...
                  </>
                ) : (
                  'Atribuir Perfil'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de Desativação Lógica (active: false) */}
      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(open) => {
          if (!open && !deactivateMutation.isPending) {
            setDeactivateTarget(null);
          }
        }}
        title="Desativar Usuário?"
        description={`O usuário "${deactivateTarget?.name}" será marcado como inativo (active = false), preservando todo o histórico de solicitações e auditoria sem exclusão.`}
        confirmLabel="Sim, Desativar Usuário"
        cancelLabel="Cancelar"
        variant="destructive"
        confirmTestId="btn-confirm-deactivate-user"
        onConfirm={() => {
          if (deactivateTarget && !deactivateMutation.isPending) {
            deactivateMutation.mutate(
              { userId: deactivateTarget.id, active: false },
              {
                onSuccess: () => setDeactivateTarget(null),
              },
            );
          }
        }}
        isLoading={deactivateMutation.isPending}
      />

      {/* Confirmação de Encerramento de Mandato Crítico */}
      <ConfirmDialog
        open={Boolean(endTenureTarget)}
        onOpenChange={(open) => {
          if (!open && !endTenureMutation.isPending) {
            setEndTenureTarget(null);
          }
        }}
        title="Encerrar Mandato Institucional?"
        description={`Você deseja encerrar a vigência do perfil "${endTenureTarget ? ROLE_LABELS[endTenureTarget.profile.role] : ''}" para ${endTenureTarget?.user.name}? A data de término (endsAt) será registrada com a data de hoje.`}
        confirmLabel="Sim, Encerrar Mandato"
        cancelLabel="Cancelar"
        variant="destructive"
        confirmTestId="btn-confirm-end-tenure"
        onConfirm={() => {
          if (endTenureTarget && !endTenureMutation.isPending) {
            endTenureMutation.mutate(
              {
                userId: endTenureTarget.user.id,
                profileId: endTenureTarget.profile.id,
              },
              {
                onSuccess: () => setEndTenureTarget(null),
              },
            );
          }
        }}
        isLoading={endTenureMutation.isPending}
      />
    </div>
  );
}
