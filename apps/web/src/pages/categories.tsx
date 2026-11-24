import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, FolderCog, Loader2, Pencil, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState, TableSkeleton } from '@/components/shared';
import { useAuth } from '@/hooks/use-auth';
import { categorySchema, type CategoryFormValues } from '@/schemas/finance.schema';
import { useCategories, useCreateCategory, useUpdateCategory } from '@/features/finance';
import type { ExpenseCategory } from '@/types/finance';

export function CategoriesPage() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseCategory | null>(null);
  const { hasPermission } = useAuth();
  const canManage = hasPermission('categories:manage');
  const categoriesQuery = useCategories();
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '' },
  });

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    return (categoriesQuery.data ?? []).filter((category) =>
      category.name.toLocaleLowerCase('pt-BR').includes(query),
    );
  }, [categoriesQuery.data, search]);

  const openCreate = () => {
    setEditing(null);
    form.reset({ name: '' });
    setDialogOpen(true);
  };

  const openEdit = (category: ExpenseCategory) => {
    setEditing(category);
    form.reset({ name: category.name });
    setDialogOpen(true);
  };

  const submit = form.handleSubmit(async (values) => {
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, payload: { name: values.name.trim() } });
    } else {
      await createMutation.mutateAsync({ name: values.name.trim() });
    }
    setDialogOpen(false);
  });

  const toggleStatus = async (category: ExpenseCategory) => {
    await updateMutation.mutateAsync({ id: category.id, payload: { active: !category.active } });
  };

  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6" data-testid="categories-page">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Categorias de despesa</h1><Badge className="bg-emerald-100 text-[#164E3F]">Rubricas</Badge></div>
          <p className="mt-1 text-sm text-slate-500">Organize as categorias disponíveis para novas solicitações.</p>
        </div>
        {canManage && <Button onClick={openCreate} className="self-start bg-[#164E3F] text-white hover:bg-[#0F382C] sm:self-auto"><Plus />Nova categoria</Button>}
      </div>

      <Card className="border-slate-200/80 bg-white shadow-2xs">
        <div className="border-b border-slate-100 p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar categoria..." className="pl-9" />
          </div>
        </div>
        <div className="overflow-x-auto">
          {categoriesQuery.isLoading ? <TableSkeleton rows={6} columns={3} /> : categoriesQuery.isError ? (
            <div className="p-10 text-center"><AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-500" /><p className="text-sm font-semibold text-slate-800">Não foi possível carregar as categorias</p><p className="mt-1 text-xs text-slate-500">Atualize a página e tente novamente.</p></div>
          ) : filteredCategories.length === 0 ? (
            <div className="p-6"><EmptyState icon={<FolderCog className="h-8 w-8" />} title={search ? 'Nenhuma categoria encontrada' : 'Nenhuma categoria cadastrada'} description={search ? 'Tente buscar por outro nome.' : 'Crie a primeira categoria para classificar as solicitações.'} action={!search && canManage ? <Button onClick={openCreate}><Plus />Criar categoria</Button> : undefined} /></div>
          ) : (
            <Table>
              <TableHeader><TableRow className="bg-slate-50"><TableHead className="pl-6">Nome</TableHead><TableHead>Status</TableHead>{canManage && <TableHead className="pr-6 text-right">Ações</TableHead>}</TableRow></TableHeader>
              <TableBody>
                {filteredCategories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="pl-6 font-semibold text-slate-800">{category.name}</TableCell>
                    <TableCell><Badge variant="outline" className={category.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}>{category.active ? 'Ativa' : 'Inativa'}</Badge></TableCell>
                    {canManage && (
                      <TableCell className="pr-6 text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(category)} disabled={pending}><Pencil />Editar</Button>
                          <Button size="sm" variant={category.active ? 'destructive' : 'outline'} onClick={() => void toggleStatus(category)} disabled={pending}>{category.active ? 'Inativar' : 'Ativar'}</Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar categoria' : 'Nova categoria'}</DialogTitle><DialogDescription>{editing ? 'Altere o nome usado para classificar solicitações.' : 'Cadastre uma nova categoria de despesa.'}</DialogDescription></DialogHeader>
          <form id="category-form" onSubmit={submit} className="space-y-1.5">
            <Label htmlFor="category-name">Nome</Label>
            <Input id="category-name" maxLength={80} autoFocus {...form.register('name')} />
            {form.formState.errors.name?.message && <p className="text-xs text-red-600">{form.formState.errors.name.message}</p>}
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button form="category-form" type="submit" disabled={pending} className="bg-[#164E3F] text-white hover:bg-[#0F382C]">{pending && <Loader2 className="animate-spin" />}{editing ? 'Salvar alterações' : 'Criar categoria'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
