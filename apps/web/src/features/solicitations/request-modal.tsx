import { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, AlertCircle, Lock } from 'lucide-react';
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
import { useCategories } from '@/features/finance/api/use-finance';
import {
  useCreateRequest,
  useUpdateRequest,
} from '@/features/requests/api';
import { isAmountLocked as checkAmountLocked } from '@/features/requests/utils/request-state-machine';
import {
  createRequestSchema,
  createUpdateRequestSchema,
} from '@/schemas';
import { moneyToApi } from '@/schemas/finance.schema';
import { applyCurrencyMask } from '@/lib/utils';
import type { Request } from '@/types';

interface RequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: Request | null;
  isAmountLocked?: boolean;
}

interface RequestModalFormValues {
  categoryId?: number;
  amount?: string;
  description: string;
}

function formatApiMoneyToMask(amount: string): string {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || numeric <= 0) return '';
  return applyCurrencyMask(numeric.toFixed(2));
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

  const { data: categories = [], isLoading: isLoadingCategories } = useCategories();
  const availableCategories = useMemo(() => {
    const active = categories.filter((c) => c.active);
    if (request && !active.some((c) => c.id === request.category.id)) {
      return [
        { id: request.category.id, name: request.category.name, active: false },
        ...active,
      ];
    }
    return active;
  }, [categories, request]);

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
    setValue,
    watch,
    formState: { errors },
  } = useForm<RequestModalFormValues>({
    resolver: zodResolver(activeSchema),
    defaultValues: {
      categoryId: undefined,
      amount: '',
      description: '',
    },
  });

  const selectedCategoryId = watch('categoryId');

  useEffect(() => {
    if (!open) return;

    createMutation.reset();
    updateMutation.reset();

    if (request) {
      reset({
        categoryId: request.category.id,
        ...(checkAmountLocked(request.status)
          ? {}
          : { amount: formatApiMoneyToMask(request.amount) }),
        description: request.description,
      });
    } else {
      reset({
        categoryId: availableCategories[0]?.id,
        amount: '',
        description: '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, request, reset]);

  useEffect(() => {
    if (open && !isEditing && !selectedCategoryId && availableCategories[0]) {
      setValue('categoryId', availableCategories[0].id);
    }
  }, [open, isEditing, selectedCategoryId, availableCategories, setValue]);

  const onSubmit = async (data: RequestModalFormValues) => {
    if (isEditing && request) {
      await updateMutation.mutateAsync({
        id: request.id,
        payload: {
          description: data.description,
          ...(!lockedAmount && data.amount
            ? { amount: moneyToApi(data.amount) }
            : {}),
        },
      });
    } else if (data.categoryId) {
      await createMutation.mutateAsync({
        categoryId: data.categoryId,
        description: data.description,
        amount: moneyToApi(data.amount ?? '0'),
      });
    }

    onOpenChange(false);
  };

  const formattedLockedAmount = request
    ? formatApiMoneyToMask(request.amount)
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
              name="categoryId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ? String(field.value) : ''}
                  onValueChange={(val) => val && field.onChange(Number(val))}
                  disabled={isEditing || isLoadingCategories}
                >
                  <SelectTrigger data-testid="select-category" className="w-full bg-white">
                    <SelectValue>
                      {(val: string | null) => {
                        if (!val) {
                          return isLoadingCategories
                            ? 'Carregando categorias...'
                            : 'Selecione a categoria';
                        }
                        return (
                          availableCategories.find((cat) => String(cat.id) === val)?.name ??
                          request?.category.name ??
                          'Selecione a categoria'
                        );
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((cat) => (
                      <SelectItem
                        key={cat.id}
                        value={String(cat.id)}
                        data-testid={`select-category-option-${cat.id}`}
                      >
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.categoryId && (
              <p className="text-xs text-red-500 font-medium">{errors.categoryId.message}</p>
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
                render={({ field }) => (
                  <CurrencyInput
                    data-testid="input-amount"
                    value={field.value ?? ''}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="0,00"
                    className="bg-white"
                  />
                )}
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
