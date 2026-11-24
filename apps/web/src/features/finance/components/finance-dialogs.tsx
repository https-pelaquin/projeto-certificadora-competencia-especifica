import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CurrencyInput } from '@/components/shared/currency-input';
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
import {
  approvalLimitSchema,
  budgetAdjustmentSchema,
  budgetSchema,
  moneyToApi,
  type ApprovalLimitFormValues,
  type BudgetAdjustmentFormValues,
  type BudgetFormValues,
} from '@/schemas/finance.schema';
import {
  useAdjustBudget,
  useCreateApprovalLimit,
  useCreateBudget,
} from '../api';

const currentYear = new Date().getFullYear();

interface OpenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-red-600">{message}</p> : null;
}

export function BudgetDialog({ open, onOpenChange }: OpenDialogProps) {
  const mutation = useCreateBudget();
  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: { year: currentYear, initialAmount: '' },
  });

  const submit = form.handleSubmit(async (values) => {
    await mutation.mutateAsync({
      year: values.year,
      initialAmount: moneyToApi(values.initialAmount),
    });
    form.reset({ year: currentYear, initialAmount: '' });
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo orçamento anual</DialogTitle>
          <DialogDescription>Cadastre o valor inicial disponível para o exercício.</DialogDescription>
        </DialogHeader>
        <form id="budget-form" onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="budget-year">Ano</Label>
            <Input id="budget-year" type="number" min={2000} max={2100} {...form.register('year', { valueAsNumber: true })} />
            <FieldError message={form.formState.errors.year?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="budget-amount">Valor inicial</Label>
            <Controller
              control={form.control}
              name="initialAmount"
              render={({ field }) => (
                <CurrencyInput id="budget-amount" value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} />
              )}
            />
            <FieldError message={form.formState.errors.initialAmount?.message} />
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button form="budget-form" type="submit" disabled={mutation.isPending} className="bg-[#164E3F] text-white hover:bg-[#0F382C]">
            {mutation.isPending && <Loader2 className="animate-spin" />}
            Criar orçamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdjustmentDialog({
  open,
  onOpenChange,
  budgetId,
}: OpenDialogProps & { budgetId: number | null }) {
  const mutation = useAdjustBudget();
  const form = useForm<BudgetAdjustmentFormValues>({
    resolver: zodResolver(budgetAdjustmentSchema),
    defaultValues: { type: 'ADJUSTMENT_IN', amount: '', justification: '' },
  });

  const submit = form.handleSubmit(async (values) => {
    if (budgetId === null) return;
    await mutation.mutateAsync({
      id: budgetId,
      payload: { ...values, amount: moneyToApi(values.amount), justification: values.justification.trim() },
    });
    form.reset();
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar orçamento</DialogTitle>
          <DialogDescription>Registre uma suplementação ou redução com justificativa.</DialogDescription>
        </DialogHeader>
        <form id="adjustment-form" onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tipo de ajuste</Label>
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={(value) => value && field.onChange(value)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADJUSTMENT_IN">Entrada</SelectItem>
                    <SelectItem value="ADJUSTMENT_OUT">Saída</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adjustment-amount">Valor</Label>
            <Controller
              control={form.control}
              name="amount"
              render={({ field }) => <CurrencyInput id="adjustment-amount" value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} />}
            />
            <FieldError message={form.formState.errors.amount?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adjustment-justification">Justificativa</Label>
            <Textarea id="adjustment-justification" rows={4} maxLength={500} {...form.register('justification')} />
            <FieldError message={form.formState.errors.justification?.message} />
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button form="adjustment-form" type="submit" disabled={mutation.isPending || budgetId === null} className="bg-[#164E3F] text-white hover:bg-[#0F382C]">
            {mutation.isPending && <Loader2 className="animate-spin" />}
            Registrar ajuste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ApprovalLimitDialog({ open, onOpenChange }: OpenDialogProps) {
  const mutation = useCreateApprovalLimit();
  const form = useForm<ApprovalLimitFormValues>({
    resolver: zodResolver(approvalLimitSchema),
    defaultValues: { amount: '', periodMonths: 6, validFrom: '' },
  });

  const submit = form.handleSubmit(async (values) => {
    await mutation.mutateAsync({
      amount: moneyToApi(values.amount),
      periodMonths: values.periodMonths,
      ...(values.validFrom
        ? { validFrom: new Date(`${values.validFrom}T00:00:00`).toISOString() }
        : {}),
    });
    form.reset();
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo limite de aprovação</DialogTitle>
          <DialogDescription>O novo limite encerra a vigência do limite anterior.</DialogDescription>
        </DialogHeader>
        <form id="limit-form" onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="limit-amount">Valor</Label>
            <Controller control={form.control} name="amount" render={({ field }) => <CurrencyInput id="limit-amount" value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} />} />
            <FieldError message={form.formState.errors.amount?.message} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="limit-period">Período (meses)</Label>
              <Input id="limit-period" type="number" min={1} max={120} {...form.register('periodMonths', { valueAsNumber: true })} />
              <FieldError message={form.formState.errors.periodMonths?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="limit-from">Início (opcional)</Label>
              <Input id="limit-from" type="date" {...form.register('validFrom')} />
              <FieldError message={form.formState.errors.validFrom?.message} />
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button form="limit-form" type="submit" disabled={mutation.isPending} className="bg-[#164E3F] text-white hover:bg-[#0F382C]">
            {mutation.isPending && <Loader2 className="animate-spin" />}
            Criar limite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
