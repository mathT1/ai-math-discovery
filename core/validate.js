// 작은 JSON 형식 검사기 (JSON Schema의 일부만 지원, 의존성 없음)
// 지원: type, required, properties, additionalProperties(false), items, enum, const,
//       minimum, maximum, minLength, maxLength, minItems, maxItems

const typeOf = (v) => {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
};

const typeMatches = (want, v) => {
  const got = typeOf(v);
  if (want === 'number') return got === 'number' || got === 'integer';
  return want === got;
};

/** @returns {string[]} 오류 목록 (비어 있으면 통과) */
export function validate(schema, value, path = '$') {
  const errors = [];
  if (!schema || typeof schema !== 'object') return errors;

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => typeMatches(t, value))) {
      errors.push(`${path}: ${types.join('|')} 형식이어야 합니다 (현재 ${typeOf(value)}).`);
      return errors;
    }
  }
  if ('const' in schema && value !== schema.const) errors.push(`${path}: ${JSON.stringify(schema.const)} 이어야 합니다.`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: ${schema.enum.join(', ')} 중 하나여야 합니다.`);

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path}: ${schema.minimum} 이상이어야 합니다.`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path}: ${schema.maximum} 이하여야 합니다.`);
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path}: 너무 짧습니다.`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path}: 너무 깁니다.`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path}: 항목이 ${schema.minItems}개 이상이어야 합니다.`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path}: 항목이 ${schema.maxItems}개 이하여야 합니다.`);
    if (schema.items) value.forEach((v, i) => errors.push(...validate(schema.items, v, `${path}[${i}]`)));
  }
  if (typeOf(value) === 'object') {
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push(`${path}.${key}: 필요한 항목이 없습니다.`);
    }
    const props = schema.properties ?? {};
    for (const [key, sub] of Object.entries(props)) {
      if (key in value) errors.push(...validate(sub, value[key], `${path}.${key}`));
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in props)) errors.push(`${path}.${key}: 알 수 없는 항목입니다.`);
      }
    } else if (typeof schema.additionalProperties === 'object') {
      for (const key of Object.keys(value)) {
        if (!(key in props)) errors.push(...validate(schema.additionalProperties, value[key], `${path}.${key}`));
      }
    }
  }
  return errors;
}

/** 모든 모듈 결과물의 공통 겉포장 형식 */
export const ENVELOPE_SCHEMA = {
  type: 'object',
  required: ['format', 'meta', 'student', 'payload', 'reflections'],
  properties: {
    format: { const: 'ai-math-result/1' },
    meta: {
      type: 'object',
      required: ['module_id', 'module_version', 'created_at'],
      properties: {
        platform_version: { type: 'string' },
        module_id: { type: 'string', minLength: 1 },
        module_version: { type: 'string' },
        created_at: { type: 'string' },
      },
    },
    student: {
      type: 'object',
      required: ['class', 'number'],
      properties: {
        class: { type: 'string', minLength: 1, maxLength: 20 },
        number: { type: 'integer', minimum: 1, maximum: 99 },
        name: { type: 'string', maxLength: 30 },
      },
    },
    payload: { type: 'object' },
    reflections: { type: 'object', additionalProperties: { type: 'string', maxLength: 5000 } },
    checksum: { type: ['string', 'null'] },
  },
};

/** 겉포장 + 모듈 payload 검사 */
export function validateResult(result, payloadSchema) {
  const errors = validate(ENVELOPE_SCHEMA, result);
  if (errors.length) return errors;
  return validate(payloadSchema, result.payload, '$.payload');
}
