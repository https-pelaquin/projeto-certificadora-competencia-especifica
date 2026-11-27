import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  createRequestCancellationSchema,
  type RequestCancellationFormValues,
} from '@/schemas/operational-request.schema';
import { useCancelOperationalRequest } from '../api';

interface CancelRequestDialogProps {
  requestId: number;
  justificationRequired: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CancelRequestDialog({
  requestId,
  justificationRequired,
  open,
  onOpenChange,
}: CancelRequestDialogProps) {
  const mutation = useCancelOperationalRequest();
  const form = useForm<RequestCancellationFormValues>({
    resolver: zodResolver(createRequestCancellationSchema(justificationRequired)),
    defaultValues: { justification: '' },
  });

  const close = () => {
    form.reset();
    onOpenChange(false);
  };

  const submit = form.handleSubmit((values) => {
    const justification = values.justification.trim();
    mutation.mutate(
      { id: requestId, payload: justification ? { justification } : {} },
      { onSuccess: close },
    );
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !mutation.isPending && (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cancelar solicitação?</DialogTitle>
          <DialogDescription>
            Esta ação encerra a solicitação e não poderá ser desfeita.
          </DialogDescription>
        </DialogHeader>
        <form id="cancel-operational-request-form" onSubmit={submit} className="space-y-2">
          <Label htmlFor="cancel-request-justification">
            Justificativa {justificationRequired ? '(obrigatória)' : '(opcional)'}
          </Label>
          <Textarea
            id="cancel-request-justification"
            rows={4}
            maxLength={500}
            placeholder="Informe o motivo do cancelamento..."
            aria-invalid={Boolean(form.formState.errors.justification)}
            {...form.register('justification')}
          />
          {form.formState.errors.justification && (
            <p className="text-xs font-medium text-red-600">{form.formState.errors.justification.message}</p>
          )}
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={mutation.isPending} onClick={close}>Voltar</Button>
          <Button form="cancel-operational-request-form" type="submit" variant="destructive" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="animate-spin" />}
            Confirmar cancelamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
