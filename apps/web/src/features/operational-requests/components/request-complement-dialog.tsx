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
  requestComplementSchema,
  type RequestComplementFormValues,
} from '@/schemas/operational-request.schema';
import { useRequestOperationalComplement } from '../api';

interface RequestComplementDialogProps {
  requestId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RequestComplementDialog({
  requestId,
  open,
  onOpenChange,
}: RequestComplementDialogProps) {
  const mutation = useRequestOperationalComplement();
  const form = useForm<RequestComplementFormValues>({
    resolver: zodResolver(requestComplementSchema),
    defaultValues: { message: '' },
  });

  const close = () => {
    form.reset();
    onOpenChange(false);
  };

  const submit = form.handleSubmit((values) => {
    mutation.mutate(
      { id: requestId, payload: { message: values.message.trim() } },
      { onSuccess: close },
    );
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !mutation.isPending && (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Solicitar complementação</DialogTitle>
          <DialogDescription>
            Explique objetivamente quais informações precisam ser acrescentadas à solicitação.
          </DialogDescription>
        </DialogHeader>
        <form id="request-complement-form" onSubmit={submit} className="space-y-2">
          <Label htmlFor="request-complement-message">Mensagem</Label>
          <Textarea
            id="request-complement-message"
            rows={5}
            maxLength={1000}
            placeholder="Descreva as informações ou documentos necessários..."
            aria-invalid={Boolean(form.formState.errors.message)}
            {...form.register('message')}
          />
          {form.formState.errors.message && (
            <p className="text-xs font-medium text-red-600">{form.formState.errors.message.message}</p>
          )}
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={mutation.isPending} onClick={close}>Voltar</Button>
          <Button form="request-complement-form" type="submit" disabled={mutation.isPending} className="bg-[#164E3F] text-white hover:bg-[#0F382C]">
            {mutation.isPending && <Loader2 className="animate-spin" />}
            Enviar solicitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
