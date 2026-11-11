import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Trash2, UploadCloud, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/shared';
import { useAuth } from '@/hooks/use-auth';
import { useUpdateAvatar } from '@/features/auth/api';

const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const AVATAR_SIZE_PX = 256;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Não foi possível ler o ficheiro selecionado.'));
      }
    };
    reader.onerror = () =>
      reject(new Error('Falha ao carregar a imagem selecionada.'));
    reader.readAsDataURL(file);
  });
}

async function processAvatarImage(file: File): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = AVATAR_SIZE_PX;
        canvas.height = AVATAR_SIZE_PX;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        // Crop central quadrado para manter proporção limpa no avatar circular
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(
          img,
          sx,
          sy,
          minSide,
          minSide,
          0,
          0,
          AVATAR_SIZE_PX,
          AVATAR_SIZE_PX,
        );

        resolve(canvas.toDataURL('image/jpeg', 0.88));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

interface ProfileAvatarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileAvatarModal({
  open,
  onOpenChange,
}: ProfileAvatarModalProps) {
  const { user } = useAuth();
  const updateAvatarMutation = useUpdateAvatar();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(
    user?.avatarUrl ?? null,
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      updateAvatarMutation.reset();
      setPreviewUrl(user?.avatarUrl ?? null);
      setValidationError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.avatarUrl]);

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    setValidationError(null);

    if (!ACCEPTED_TYPES.has(file.type)) {
      setValidationError(
        'Formato não suportado. Selecione uma imagem PNG, JPG ou WEBP.',
      );
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setValidationError('A imagem deve ter no máximo 2 MB.');
      return;
    }

    try {
      const processed = await processAvatarImage(file);
      setPreviewUrl(processed);
    } catch (err) {
      setValidationError(
        err instanceof Error
          ? err.message
          : 'Erro ao processar a imagem selecionada.',
      );
    }
  };

  const hasChanges = (previewUrl ?? null) !== (user?.avatarUrl ?? null);

  const handleSave = async () => {
    if (!hasChanges || updateAvatarMutation.isPending) return;
    await updateAvatarMutation.mutateAsync({ avatarUrl: previewUrl });
    onOpenChange(false);
  };

  const handleRemove = async () => {
    if (updateAvatarMutation.isPending) return;
    setValidationError(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!updateAvatarMutation.isPending) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent data-testid="modal-profile-avatar" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Camera className="h-5 w-5 text-[#164E3F]" />
            Foto de Perfil
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Escolha uma imagem para identificar sua conta na plataforma do DACOM.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-3">
          {/* Preview circular */}
          <div className="relative">
            <UserAvatar
              name={user?.name}
              avatarUrl={previewUrl}
              className="h-24 w-24 ring-4 ring-emerald-500/20 shadow-sm"
              fallbackClassName="bg-gradient-to-tr from-[#164E3F] to-emerald-600 text-white text-2xl"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={updateAvatarMutation.isPending}
              title="Selecionar imagem"
              className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-[#164E3F] text-white shadow-md ring-2 ring-white hover:bg-[#0F382C] transition-colors cursor-pointer disabled:opacity-50"
            >
              <Camera className="h-4 w-4" />
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>

          {/* Input oculto + área de upload */}
          <input
            ref={fileInputRef}
            data-testid="input-avatar-file"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              void handleFileSelected(e.target.files?.[0]);
            }}
          />

          <div className="flex flex-wrap items-center justify-center gap-2 w-full">
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="btn-select-avatar"
              disabled={updateAvatarMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5 text-xs cursor-pointer"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              Escolher nova foto
            </Button>

            {previewUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                data-testid="btn-remove-avatar"
                disabled={updateAvatarMutation.isPending}
                onClick={handleRemove}
                className="gap-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remover foto
              </Button>
            )}
          </div>

          <p className="text-[11px] text-slate-400">
            PNG, JPG ou WEBP (máximo 2 MB). A imagem será ajustada automaticamente.
          </p>

          {(validationError || updateAvatarMutation.isError) && (
            <div
              data-testid="avatar-modal-error"
              className="w-full rounded-lg bg-red-50 border border-red-200 p-3 flex items-center gap-2"
            >
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              <p className="text-xs text-red-700">
                {validationError ??
                  (updateAvatarMutation.error instanceof Error
                    ? updateAvatarMutation.error.message
                    : 'Não foi possível salvar a foto de perfil.')}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            data-testid="btn-cancel-avatar"
            disabled={updateAvatarMutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            data-testid="btn-save-avatar"
            disabled={!hasChanges || updateAvatarMutation.isPending}
            onClick={handleSave}
            className="bg-[#164E3F] hover:bg-[#0F382C] text-white cursor-pointer"
          >
            {updateAvatarMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Foto'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

