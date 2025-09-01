import { z } from 'zod';

export function zodFromJsonSchema(schema: any): z.ZodTypeAny {
  if (!schema) return z.any();

  switch (schema.type) {
    case 'string': {
      let stringSchema = z.string();
      if (schema.description) {
        stringSchema = stringSchema.describe(schema.description);
      }
      if (schema.minLength !== undefined) {
        stringSchema = stringSchema.min(schema.minLength);
      }
      if (schema.maxLength !== undefined) {
        stringSchema = stringSchema.max(schema.maxLength);
      }
      if (schema.pattern) {
        stringSchema = stringSchema.regex(new RegExp(schema.pattern));
      }
      if (schema.enum) {
        return z.enum(schema.enum as [string, ...string[]]);
      }
      return stringSchema;
    }

    case 'number':
    case 'integer': {
      let numberSchema = schema.type === 'integer' ? z.number().int() : z.number();
      if (schema.description) {
        numberSchema = numberSchema.describe(schema.description);
      }
      if (schema.minimum !== undefined) {
        numberSchema = numberSchema.min(schema.minimum);
      }
      if (schema.maximum !== undefined) {
        numberSchema = numberSchema.max(schema.maximum);
      }
      return numberSchema;
    }

    case 'boolean':
      return schema.description ? z.boolean().describe(schema.description) : z.boolean();

    case 'array': {
      const itemSchema = zodFromJsonSchema(schema.items || {});
      let arraySchema = z.array(itemSchema);
      if (schema.description) {
        arraySchema = arraySchema.describe(schema.description);
      }
      if (schema.minItems !== undefined) {
        arraySchema = arraySchema.min(schema.minItems);
      }
      if (schema.maxItems !== undefined) {
        arraySchema = arraySchema.max(schema.maxItems);
      }
      return arraySchema;
    }

    case 'object': {
      const shape: Record<string, z.ZodTypeAny> = {};
      
      for (const [key, value] of Object.entries(schema.properties || {})) {
        let fieldSchema = zodFromJsonSchema(value);
        
        // Handle required fields
        const isRequired = schema.required?.includes(key);
        if (!isRequired) {
          fieldSchema = fieldSchema.optional();
        }
        
        shape[key] = fieldSchema;
      }
      
      let objectSchema = z.object(shape);
      if (schema.description) {
        objectSchema = objectSchema.describe(schema.description);
      }
      
      // Handle additionalProperties
      if (schema.additionalProperties === false) {
        return objectSchema.strict() as any;
      } else if (schema.additionalProperties === true || schema.additionalProperties) {
        return objectSchema.passthrough() as any;
      }
      
      return objectSchema;
    }

    case 'null':
      return z.null();

    default:
      // Handle union types (oneOf, anyOf)
      if (schema.oneOf || schema.anyOf) {
        const schemas = (schema.oneOf || schema.anyOf).map(zodFromJsonSchema);
        if (schemas.length === 0) return z.any();
        if (schemas.length === 1) return schemas[0];
        return z.union(schemas as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
      }
      
      // Handle allOf
      if (schema.allOf) {
        const schemas = schema.allOf.map(zodFromJsonSchema);
        if (schemas.length === 0) return z.any();
        if (schemas.length === 1) return schemas[0];
        // For allOf, we need to merge the schemas, which is complex
        // For simplicity, we'll use intersection for object types
        return schemas.reduce((acc: any, curr: any) => acc.and(curr));
      }
      
      return z.any();
  }
}