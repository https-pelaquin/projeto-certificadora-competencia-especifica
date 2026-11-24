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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOpenVoting } from '@/features/votings/api';
import { toast } from '@/lib/toast';
import {
  openVotingSchema,
  type OpenVotingFormValues,
} from '@/schemas/voting.schema';

interface OpenVotingDialogProps {
  requestId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpened?: (votingId: number) => void;
}

export function OpenVotingDialog({
  requestId,
  open,
  onOpenChange,
  onOpened,
}: OpenVotingDialogProps) {
  const mutation = useOpenVoting();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OpenVotingFormValues>({
    resolver: zodResolver(openVotingSchema),
    defaultValues: { deadline: '' },
  });

  const submit = handleSubmit((values) => {
    mutation.mutate(
      {
        requestId,
        payload: { deadline: new Date(values.deadline).toISOString() },
      },
      {
        onSuccess: (voting) => {
          toast.success('A votação foi aberta e os conselheiros foram convocados.');
          reset();
          onOpenChange(false);
          onOpened?.(voting.id);
        },
      },
    );
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!mutation.isPending) {
          onOpenChange(nextOpen);
          if (!nextOpen) reset();
        }
      }}
    >
      <DialogContent data-testid="open-voting-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Abrir votação</DialogTitle>
          <DialogDescription>
            Defina o prazo final. O voto de cada conselheiro é definitivo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" data-testid="open-voting-form">
          <div className="space-y-2">
            <Label htmlFor="voting-deadline">Prazo final</Label>
            <Input
              id="voting-deadline"
              type="datetime-local"
              data-testid="input-voting-deadline"
              aria-invalid={Boolean(errors.deadline)}
              {...register('deadline')}
            />
            {errors.deadline && (
              <p className="text-xs font-medium text-red-600" data-testid="error-voting-deadline">
                {errors.deadline.message}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              data-testid="btn-confirm-open-voting"
              className="bg-[#164E3F] text-white hover:bg-[#0F382C]"
            >
              {mutation.isPending && <Loader2 className="animate-spin" />}
              Abrir votação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
