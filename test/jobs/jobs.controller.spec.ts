import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest') as typeof import('supertest');
import { JobsModule } from '../../src/jobs/jobs.module';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUE_NAME } from '../../src/config/constants';

const mockJobs = [
  {
    id: '1',
    data: { documentId: 'doc-1' },
    attemptsMade: 1,
    failedReason: undefined,
    finishedOn: 1713700000000,
    processedOn: 1713699990000,
    timestamp: 1713699980000,
    getState: jest.fn().mockResolvedValue('completed'),
  },
  {
    id: '2',
    data: { documentId: 'doc-2' },
    attemptsMade: 0,
    failedReason: undefined,
    finishedOn: undefined,
    processedOn: undefined,
    timestamp: 1713699985000,
    getState: jest.fn().mockResolvedValue('waiting'),
  },
];

describe('JobsController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [JobsModule],
    })
      .overrideProvider(getQueueToken(QUEUE_NAME))
      .useValue({
        getJobs: jest.fn().mockResolvedValue(mockJobs),
        getJob: jest.fn().mockImplementation((id: string) => {
          const job = mockJobs.find((j) => j.id === id);
          return Promise.resolve(job ?? null);
        }),
      })
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /jobs', () => {
    it('returns all jobs with state and metadata', async () => {
      const response = await request(app.getHttpServer())
        .get('/jobs')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject({
        jobId: '1',
        documentId: 'doc-1',
        state: 'completed',
        attemptsMade: 1,
      });
      expect(response.body[1]).toMatchObject({
        jobId: '2',
        documentId: 'doc-2',
        state: 'waiting',
      });
    });
  });

  describe('GET /jobs/:jobId', () => {
    it('returns single job detail', async () => {
      const response = await request(app.getHttpServer())
        .get('/jobs/1')
        .expect(200);

      expect(response.body.jobId).toBe('1');
      expect(response.body.state).toBe('completed');
    });

    it('returns 404 for non-existent job', async () => {
      await request(app.getHttpServer())
        .get('/jobs/999')
        .expect(404);
    });
  });
});
