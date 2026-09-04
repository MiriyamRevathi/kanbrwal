import type { Priority, RiskLevel, TaskStatus } from '../types.js';

export type TemplateTask = {
  taskKey: string;
  title: string;
  description: string;
  defaultColumn: TaskStatus;
  priority: Priority;
  estimatedHours: number;
  riskLevel: RiskLevel;
  tags: string[];
  dependencies: string[];
};

export type TemplateMilestone = {
  milestoneKey: string;
  name: string;
  description: string;
  targetDaysOffset: number;
  tasks: TemplateTask[];
};

export type EnterpriseProjectTemplate = {
  templateId: string;
  name: string;
  category: 'cloud_migration' | 'fintech_banking' | 'healthcare_hipaa' | 'ecommerce_omni' | 'cybersecurity';
  description: string;
  estimatedTotalHours: number;
  milestones: TemplateMilestone[];
};

export class EnterpriseProjectTemplateRegistry {
  private templates: EnterpriseProjectTemplate[] = [];

  constructor() {
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    const ecomTemplate: EnterpriseProjectTemplate = {
      templateId: 'tmpl_ecom_v2',
      name: 'Omni-Channel E-Commerce Architecture Standard',
      category: 'ecommerce_omni',
      description: 'Standardized delivery template for multi-currency payment, Redis inventory sync, and GraphQL catalog.',
      estimatedTotalHours: 1200,
      milestones: [
        {
          milestoneKey: 'M1_CORE_GATEWAY',
          name: 'Payment & Checkout Foundation',
          description: 'PCI-DSS compliant payment integration and inventory reservation.',
          targetDaysOffset: 30,
          tasks: [
            {
              taskKey: 'ECOM-101',
              title: 'Stripe & PayPal Multi-Currency Payment Gateway Integration',
              description: 'Implement webhook signature verification, 3DS challenge handling, and fallback retry logic.',
              defaultColumn: 'In Progress',
              priority: 'P0',
              estimatedHours: 40,
              riskLevel: 'medium',
              tags: ['Payment', 'Stripe', 'API', 'Security'],
              dependencies: [],
            },
            {
              taskKey: 'ECOM-102',
              title: 'Real-time Redis Inventory Sync during Flash Sales',
              description: 'Implement distributed locking mechanism using Redlock algorithm to prevent double-sell issues.',
              defaultColumn: 'Review',
              priority: 'P0',
              estimatedHours: 32,
              riskLevel: 'high',
              tags: ['Redis', 'Distributed Systems', 'Performance'],
              dependencies: ['ECOM-101'],
            },
            {
              taskKey: 'ECOM-103',
              title: 'GraphQL Product Catalog & Automated Invalidation Cache',
              description: 'Build Apollo GraphQL server layer with Redis cache warming for catalog endpoints.',
              defaultColumn: 'To Do',
              priority: 'P1',
              estimatedHours: 24,
              riskLevel: 'low',
              tags: ['GraphQL', 'Backend', 'Cache'],
              dependencies: [],
            },
          ],
        },
        {
          milestoneKey: 'M2_ORDER_FULFILLMENT',
          name: 'Order Processing & WMS Integration',
          description: 'Order state machine, warehouse dispatch, and shipping partner integration.',
          targetDaysOffset: 60,
          tasks: [
            {
              taskKey: 'ECOM-201',
              title: 'Warehouse Management System (WMS) Webhook Pipeline',
              description: 'Construct resilient SQS-backed event queue for real-time order status updates from 3PL partners.',
              defaultColumn: 'Backlog',
              priority: 'P1',
              estimatedHours: 48,
              riskLevel: 'medium',
              tags: ['WMS', 'Webhooks', 'SQS'],
              dependencies: ['ECOM-102'],
            },
            {
              taskKey: 'ECOM-202',
              title: 'Automated Tax & Duty Calculator Service Integration',
              description: 'Integrate Avalara AvaTax API for dynamic VAT and sales tax calculation during checkout.',
              defaultColumn: 'Backlog',
              priority: 'P2',
              estimatedHours: 16,
              riskLevel: 'low',
              tags: ['Tax', 'Integration', 'Finance'],
              dependencies: ['ECOM-101'],
            },
          ],
        },
      ],
    };

    const hospTemplate: EnterpriseProjectTemplate = {
      templateId: 'tmpl_hosp_v1',
      name: 'HIPAA Health Record & Outpatient Triage System',
      category: 'healthcare_hipaa',
      description: 'HIPAA compliant EHR ingestion pipeline, FHIR parser, patient triage queue, and pharmacy dispenser.',
      estimatedTotalHours: 1600,
      milestones: [
        {
          milestoneKey: 'M1_FHIR_INGESTION',
          name: 'HL7 FHIR Record Parsing Pipeline',
          description: 'Secure FHIR v4 Bundle ingestion and encrypted database storage.',
          targetDaysOffset: 45,
          tasks: [
            {
              taskKey: 'HOSP-101',
              title: 'HL7 FHIR Patient Health Records Ingestion Pipeline',
              description: 'Ingest and validate HL7 v4 JSON messages with strict HIPAA audit logging and PII masking.',
              defaultColumn: 'In Progress',
              priority: 'P0',
              estimatedHours: 56,
              riskLevel: 'high',
              tags: ['HIPAA', 'HL7', 'FHIR', 'Healthcare'],
              dependencies: [],
            },
            {
              taskKey: 'HOSP-102',
              title: 'HIPAA Access Audit Log Verification Engine',
              description: 'Build immutable audit trail recorder for all patient EHR access and mutation attempts.',
              defaultColumn: 'To Do',
              priority: 'P0',
              estimatedHours: 40,
              riskLevel: 'medium',
              tags: ['Audit', 'Security', 'Compliance'],
              dependencies: ['HOSP-101'],
            },
          ],
        },
      ],
    };

    this.templates.push(ecomTemplate, hospTemplate);
  }

  public getTemplates(): EnterpriseProjectTemplate[] {
    return this.templates;
  }

  public getTemplateById(templateId: string): EnterpriseProjectTemplate | undefined {
    return this.templates.find((t) => t.templateId === templateId);
  }
}

export const globalTemplateRegistry = new EnterpriseProjectTemplateRegistry();
