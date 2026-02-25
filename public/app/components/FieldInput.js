import { computed } from 'vue';

// Smart input component that renders the right input type based on a field descriptor
export default {
  name: 'FieldInput',
  props: {
    field: { type: Object, required: true },  // field descriptor from /api/table/:name
    modelValue: { default: null },
    functionValue: { type: String, default: '' }, // SQL function override
  },
  emits: ['update:modelValue', 'update:functionValue'],
  setup(props, { emit }) {
    const inputType = computed(() => {
      const t = (props.field.type || '').toLowerCase();
      if (['date'].includes(t)) return 'date';
      if (['time'].includes(t)) return 'time';
      if (['datetime', 'timestamp'].includes(t)) return 'datetime-local';
      if (['int','tinyint','smallint','mediumint','bigint','integer','serial','bigserial','smallserial'].includes(t)) return 'number';
      if (['float','double','decimal','numeric','real'].includes(t)) return 'number';
      if (['text','tinytext','mediumtext','longtext','clob'].includes(t)) return 'textarea';
      if (t === 'enum') return 'enum';
      if (t === 'boolean' || t === 'bool') return 'boolean';
      return 'text';
    });

    const enumValues = computed(() => {
      if (inputType.value !== 'enum') return [];
      // Parse 'a','b','c' format
      const len = props.field.length || '';
      return len.match(/'([^']*)'/g)?.map(s => s.replace(/^'|'$/g, '')) || [];
    });

    const isNullable = computed(() => props.field.nullable);

    function onInput(e) {
      emit('update:modelValue', e.target.value);
    }

    function onCheckNull(e) {
      emit('update:modelValue', e.target.checked ? null : '');
    }

    return { inputType, enumValues, isNullable, onInput, onCheckNull };
  },
  template: `
    <div class="flex items-start gap-2">
      <!-- NULL toggle for nullable fields -->
      <label v-if="isNullable" class="flex items-center gap-1 text-xs text-base-content/60 mt-1 shrink-0">
        <input type="checkbox" class="checkbox checkbox-xs"
          :checked="modelValue === null"
          @change="onCheckNull" />
        NULL
      </label>

      <!-- Enum select -->
      <select v-if="inputType === 'enum' && modelValue !== null"
        class="select select-sm select-bordered flex-1"
        :value="modelValue" @change="e => $emit('update:modelValue', e.target.value)">
        <option v-if="isNullable" value="">— select —</option>
        <option v-for="v in enumValues" :key="v" :value="v">{{ v }}</option>
      </select>

      <!-- Boolean checkbox -->
      <input v-else-if="inputType === 'boolean' && modelValue !== null"
        type="checkbox" class="checkbox checkbox-sm mt-1"
        :checked="!!modelValue" @change="e => $emit('update:modelValue', e.target.checked ? 1 : 0)" />

      <!-- Textarea for long text -->
      <textarea v-else-if="inputType === 'textarea' && modelValue !== null"
        class="textarea textarea-sm textarea-bordered flex-1 font-mono text-sm"
        rows="3"
        :value="modelValue ?? ''"
        @input="onInput">
      </textarea>

      <!-- Standard inputs -->
      <input v-else-if="modelValue !== null"
        :type="inputType"
        class="input input-sm input-bordered flex-1 font-mono text-sm"
        :value="modelValue ?? ''"
        :step="inputType === 'number' ? 'any' : undefined"
        @input="onInput" />

      <span v-if="modelValue === null && isNullable" class="italic text-base-content/40 text-sm mt-1">NULL</span>
    </div>
  `,
};
