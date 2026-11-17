import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, UploadCloud, FileCheck, AlertCircle, Lock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CurrencyInput } from '@/components/shared';
import {
  useCreateRequest,
  useUpdateRequest,
} from '@/features/requests/api';
import { isAmountLocked as checkAmountLocked } from '@/features/requests/utils/request-state-machine';
import {
  createRequestSchema,
  createUpdateRequestSchema,
} from '@/schemas';
import { applyCurrencyMask, parseCurrencyToCents } from '@/lib/utils';
import {
  EXPENSE_CATEGORY_LABELS,
  type ExpenseCategory,
  type Request,
} from '@/types';

interface RequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: Request | null;
  isAmountLocked?: boolean;
}

interface RequestModalFormValues {
  category?: ExpenseCategory;
  amount?: number;
  description: string;
}

export function RequestModal({
  open,
  onOpenChange,
  request,
  isAmountLocked: isAmountLockedProp,
}: RequestModalProps) {
  const isEditing = Boolean(request);
  const lockedAmount =
    isAmountLockedProp ?? (request ? checkAmountLocked(request.status) : false);

  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const createMutation = useCreateRequest();
  const updateMutation = useUpdateRequest();
  const activeMutation = isEditing ? updateMutation : createMutation;

  const activeSchema = useMemo(() => {
    if (isEditing && request) {
      return createUpdateRequestSchema(request.status);
    }
    return createRequestSchema;
  }, [isEditing, request]);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RequestModalFormValues>({
    resolver: zodResolver(activeSchema),
    defaultValues: {
      category: 'MATERIAL_CONSUMO',
      amount: 0,
      description: '',
    },
  });

  useEffect(() => {
    if (!open) return;

    createMutation.reset();
    updateMutation.reset();

    if (request) {
      reset({
        category: request.category,
        ...(checkAmountLocked(request.status)
          ? {}
          : { amount: request.amount / 100 }),
        description: request.description,
      });
      setSelectedFileName(request.attachmentName ?? null);
    } else {
      reset({
        category: 'MATERIAL_CONSUMO',
        amount: 0,
        description: '',
      });
      setSelectedFileName(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, request, reset]);

  const onSubmit = async (data: RequestModalFormValues) => {
    if (isEditing && request) {
      await updateMutation.mutateAsync({
        id: request.id,
        payload: {
          description: data.description,
          ...(!lockedAmount && data.amount !== undefined
            ? { amount: Math.round(data.amount * 100) }
            : {}),
          ...(selectedFileName ? { attachmentName: selectedFileName } : {}),
        },
      });
    } else {
      await createMutation.mutateAsync({
        category: data.category ?? 'MATERIAL_CONSUMO',
        description: data.description,
        amount: Math.round((data.amount ?? 0) * 100),
        ...(selectedFileName ? { attachmentName: selectedFileName } : {}),
      });
    }

    onOpenChange(false);
  };

  const formattedLockedAmount = request
    ? applyCurrencyMask(String(request.amount))
    : '';

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!activeMutation.isPending) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent data-testid="modal-request" className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900">
            {isEditing ? 'Editar Solicitação' : 'Novo Pedido de Recurso'}
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            {isEditing
              ? lockedAmount
                ? 'Após aprovação, o valor da solicitação está travado. Apenas o texto pode ser editado.'
                : 'Atualize os dados e justificativa da solicitação financeira.'
              : 'Preencha os campos abaixo com as informações da despesa para encaminhar para votação/análise.'}
          </DialogDescription>
        </DialogHeader>

        <form data-testid="form-request" onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {/* Categoria */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Categoria de Despesa *</Label>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? 'MATERIAL_CONSUMO'}
                  onValueChange={(val) => val && field.onChange(val as ExpenseCategory)}
                  disabled={isEditing}
                >
                  <SelectTrigger data-testid="select-category" className="w-full bg-white">
                    <SelectValue>
                      {(val: string | null) =>
                        val
                          ? EXPENSE_CATEGORY_LABELS[val as ExpenseCategory] ?? val
                          : 'Selecione a categoria'
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(EXPENSE_CATEGORY_LABELS) as [ExpenseCategory, string][]).map(
                      ([catKey, label]) => (
                        <SelectItem
                          key={catKey}
                          value={catKey}
                          data-testid={`select-category-option-${catKey}`}
                        >
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.category && (
              <p className="text-xs text-red-500 font-medium">{errors.category.message}</p>
            )}
          </div>

          {/* Valor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-700">Valor do Pedido (R$) *</Label>
              {lockedAmount && (
                <span
                  data-testid="badge-amount-locked"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200"
                >
                  <Lock className="h-3 w-3" />
                  Travado (Solicitação Aprovada)
                </span>
              )}
            </div>
            {lockedAmount ? (
              <CurrencyInput
                data-testid="input-amount"
                value={formattedLockedAmount}
                onValueChange={() => {}}
                disabled
                placeholder="0,00"
                className="bg-slate-100 cursor-not-allowed opacity-80"
              />
            ) : (
              <Controller
                name="amount"
                control={control}
                render={({ field }) => {
                  const displayValue =
                    typeof field.value === 'number' && field.value > 0
                      ? applyCurrencyMask(String(Math.round(field.value * 100)))
                      : '';
                  return (
                    <CurrencyInput
                      data-testid="input-amount"
                      value={displayValue}
                      onValueChange={(masked) => {
                        const cents = masked ? parseCurrencyToCents(masked) : 0;
                        field.onChange(Number.isNaN(cents) ? 0 : cents / 100);
                      }}
                      placeholder="0,00"
                      className="bg-white"
                    />
                  );
                }}
              />
            )}
            {!lockedAmount && errors.amount && (
              <p data-testid="error-amount" className="text-xs text-red-500 font-medium">
                {errors.amount.message}
              </p>
            )}
          </div>

          {/* Justificativa / Descrição */}
          <div className="space-y-1.5">
            <Label htmlFor="desc-input" className="text-xs font-semibold text-slate-700">
              Justificativa / Descrição da Despesa *
            </Label>
            <Textarea
              id="desc-input"
              data-testid="input-description"
              rows={4}
              placeholder="Descreva detalhadamente o item ou serviço, sua necessidade acadêmica e impacto..."
              className="resize-none bg-white text-sm"
              {...register('description')}
            />
            {errors.description && (
              <p data-testid="error-description" className="text-xs text-red-500 font-medium">
                {errors.description.message}
              </p>
            )}
          </div>

          {/* Visual file attachment area */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Anexo Comprobatório / Orçamento</Label>
            <label
              htmlFor="file-upload"
              className="border-2 border-dashed border-slate-300 hover:border-emerald-600 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-emerald-50/20 group"
            >
              <input
                id="file-upload"
                data-testid="input-attachment"
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setSelectedFileName(e.target.files[0].name);
                  }
                }}
              />
              {selectedFileName ? (
                <div className="flex items-center gap-2 text-emerald-800">
                  <FileCheck className="h-5 w-5 text-emerald-600" />
                  <span className="text-xs font-semibold truncate max-w-xs">{selectedFileName}</span>
                  <span className="text-[10px] text-slate-400">(Clique para substituir)</span>
                </div>
              ) : (
                <>
                  <UploadCloud className="h-7 w-7 text-slate-400 group-hover:text-emerald-700 transition-colors mb-1" />
                  <p className="text-xs font-medium text-slate-700">
                    Clique para selecionar arquivo de cotação ou orçamento
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">PDF, PNG ou JPG (até 10MB)</p>
                </>
              )}
            </label>
          </div>

          {activeMutation.isError && (
            <div
              data-testid="request-modal-error"
              className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-center gap-2"
            >
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              <p className="text-xs text-red-700">
                {activeMutation.error instanceof Error
                  ? activeMutation.error.message
                  : 'Ocorreu um erro ao salvar a solicitação. Tente novamente.'}
              </p>
            </div>
          )}

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              data-testid="btn-modal-cancel"
              onClick={() => onOpenChange(false)}
              disabled={activeMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              data-testid="btn-submit-request"
              disabled={activeMutation.isPending}
              className="bg-[#164E3F] hover:bg-[#0F382C] text-white"
            >
              {activeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : isEditing ? (
                'Salvar Alterações'
              ) : (
                'Enviar Solicitação'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
