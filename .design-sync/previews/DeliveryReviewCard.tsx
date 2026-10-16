import { DeliveryReviewCard } from 'orcamentos-tematicos';

const completa = {
  id: 'ent-1',
  name: 'Formação continuada de professores',
  description:
    'Curso de recomposição das aprendizagens em língua portuguesa e matemática para docentes do ensino médio da rede estadual.',
  quantity: 412,
  municipality: 'Rio Branco',
  beneficiaries: 'Professores do ensino médio e, indiretamente, 9.800 estudantes das escolas atendidas.',
  executedValue: 1_284_530.75,
};

export const Completa = () => (
  <ul className="flex flex-col gap-2" style={{ width: '44rem' }}>
    <DeliveryReviewCard delivery={completa} index={0} />
  </ul>
);

export const ValorInformadoNaAcao = () => (
  <ul className="flex flex-col gap-2" style={{ width: '44rem' }}>
    <DeliveryReviewCard
      delivery={{
        description: 'Aquisição de kits pedagógicos para as escolas estaduais da regional do Juruá.',
        quantity: 86,
        municipality: 'Cruzeiro do Sul',
        beneficiaries: 'Estudantes do ensino fundamental II.',
      }}
      index={1}
      executedValue={642_900}
    />
  </ul>
);

export const SemDescricao = () => (
  <ul className="flex flex-col gap-2" style={{ width: '44rem' }}>
    <DeliveryReviewCard
      delivery={{ description: '', quantity: 3, municipality: 'Tarauacá', beneficiaries: '' }}
      index={2}
    />
  </ul>
);

export const Lista = () => (
  <ul className="flex flex-col gap-2" style={{ width: '44rem' }}>
    <DeliveryReviewCard
      delivery={{
        id: 'ent-1',
        name: 'Formação continuada de professores',
        description: 'Curso de recomposição das aprendizagens para docentes do ensino médio.',
        quantity: 412,
        municipality: 'Rio Branco',
        beneficiaries: '',
        executedValue: 1_284_530.75,
      }}
      index={0}
    />
    <DeliveryReviewCard
      delivery={{
        id: 'ent-2',
        name: 'Oficinas de leitura nas escolas do campo',
        description: 'Oficinas itinerantes de leitura e escrita em escolas rurais e indígenas.',
        quantity: 38,
        municipality: 'Feijó',
        beneficiaries: '',
        executedValue: 215_400,
      }}
      index={1}
    />
    <DeliveryReviewCard
      delivery={{
        id: 'ent-3',
        description: 'Reforma de salas de recursos multifuncionais para educação especial.',
        quantity: 12,
        municipality: 'Sena Madureira',
        beneficiaries: '',
        executedValue: 498_120.4,
      }}
      index={2}
    />
  </ul>
);
