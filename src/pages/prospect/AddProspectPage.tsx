import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { prospectService } from '@/services/prospectService';
import { apiErrorMessage } from '@/api/tenantClient';
import { ProspectForm } from '@/components/prospect/ProspectForm';

export default function AddProspectPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: (fields: Record<string, unknown>) => prospectService.create(fields),
    onSuccess: (prospect) => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      navigate(`/prospects/${prospect.id}`);
    },
  });

  return (
    <div className="flex-1 bg-stone-50 p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/20 text-brand-dark">
          <UserPlus className="size-4.5" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-stone-900">Prospect</h1>
          <p className="text-xs text-stone-500">Create a new prospect record.</p>
        </div>
      </div>

      <ProspectForm
        submitting={create.isPending}
        errorMessage={create.error ? apiErrorMessage(create.error, 'Could not save the prospect.') : null}
        onSubmit={(fields) => create.mutate(fields)}
        onCancel={() => navigate('/prospects')}
      />
    </div>
  );
}
