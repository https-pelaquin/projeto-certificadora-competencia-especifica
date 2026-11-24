import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  createPaymentSchema,
  moneyToApi,
  type PaymentFormValues,
} from '@/schemas/finance.schema';
import { useRecordPayment } from '../api';

export interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: number;
  provisionedAmount: string;
  requestDescription?: string;
}

export function PaymentDialog({
  open,
  onOpenChange,
  requestId,
  provisionedAmount,
  requestDescription,
}: PaymentDialogProps) {
  const schema = useMemo(
    () => createPaymentSchema(provisionedAmount),
    [provisionedAmount],
  );
  const mutation = useRecordPayment();
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(schema),
    values: {
      paidAmount: Number(provisionedAmount).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      justification: '',
    },
  });

  const submit = form.handleSubmit(async (values) => {
    await mutation.mutateAsync({
      requestId,
      payload: {
        paidAmount: moneyToApi(values.paidAmount),
        ...(values.justification.trim()
          ? { justification: values.justification.trim() }
          : {}),
      },
    });
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription>
            {requestDescription ?? `Solicitação #${requestId}`}. Valor provisionado: R$ {Number(provisionedAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.
          </DialogDescription>
        </DialogHeader>
        <form id="payment-form" onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="payment-amount">Valor pago</Label>
            <Controller control={form.control} name="paidAmount" render={({ field }) => <CurrencyInput id="payment-amount" value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} />} />
            {form.formState.errors.paidAmount?.message && <p className="text-xs text-red-600">{form.formState.errors.paidAmount.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payment-justification">Justificativa da diferença</Label>
            <Textarea id="payment-justification" rows={4} maxLength={500} placeholder="Obrigatória quando o valor pago difere do provisionado" {...form.register('justification')} />
            {form.formState.errors.justification?.message && <p className="text-xs text-red-600">{form.formState.errors.justification.message}</p>}
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button form="payment-form" type="submit" disabled={mutation.isPending} className="bg-[#164E3F] text-white hover:bg-[#0F382C]">
            {mutation.isPending && <Loader2 className="animate-spin" />}
            Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
