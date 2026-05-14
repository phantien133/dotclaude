---
description: Generate test file skeletons from impact.md — correct import boilerplate per affected layer so TDD starts with structure, not a blank file.
argument-hint: <task-title>
allowed-tools: Read, Write, Bash
---

# streaming-test-stubs

Generate test file skeletons for task `$ARGUMENTS` based on `impact.md`.

## Steps

1. Read `streaming-docs/workflow/<task-title>/impact.md` — extract:
   - Affected modules and their change types
   - New services, resolvers, processors
   - DB changes (new Prisma models)
   - BullMQ queues/processors

2. For each affected layer, generate a test stub file with correct boilerplate:

### NestJS Service stub
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { <ServiceName> } from './<service>.service';
import { PrismaService } from '../../database/prisma.service';

describe('<ServiceName>', () => {
  let service: <ServiceName>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        <ServiceName>,
        { provide: PrismaService, useValue: { /* mock */ } },
      ],
    }).compile();

    service = module.get<<ServiceName>>(<ServiceName>);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // TODO: add tests for each method
});
```

### GraphQL Resolver stub
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { <ResolverName> } from './<resolver>.resolver';
import { <ServiceName> } from './<service>.service';

describe('<ResolverName>', () => {
  let resolver: <ResolverName>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        <ResolverName>,
        { provide: <ServiceName>, useValue: { /* mock */ } },
      ],
    }).compile();

    resolver = module.get<<ResolverName>>(<ResolverName>);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
```

### BullMQ Processor stub
```typescript
import { <ProcessorName> } from './<processor>.processor';
import { Job } from 'bullmq';

describe('<ProcessorName>', () => {
  let processor: <ProcessorName>;

  beforeEach(() => {
    processor = new <ProcessorName>(/* mock deps */);
  });

  it('should handle job', async () => {
    const job = { data: { /* test payload */ } } as Job;
    await expect(processor.process(job)).resolves.not.toThrow();
  });
});
```

3. Write stub files to the correct paths (mirror source structure)
4. Update `tests.md` with the list of generated stub files

## Output

List all generated files with paths. Developer fills in `expect()` logic — stub provides the structure.
