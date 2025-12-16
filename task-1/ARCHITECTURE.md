# Enterprise SaaS Platform Architecture for Workplace Optimization

## Executive Overview

This document presents a comprehensive architectural blueprint for building an enterprise-grade, multi-tenant SaaS platform designed to help Fortune 500 companies optimize their real estate portfolios through data-driven insights. The architecture addresses the unique challenges of processing high-volume IoT sensor data from global deployments while maintaining strict security, compliance, and performance requirements demanded by enterprise customers.

### The Business Context

In the post-pandemic era, enterprises face a fundamental challenge: their office spaces were designed for a pre-hybrid work world. A typical Fortune 500 company might maintain 200+ office locations globally, each equipped with thousands of occupancy sensors generating millions of data points daily. However, without intelligent analysis, this data creates noise rather than insights. Our platform transforms this raw occupancy data into actionable intelligence that helps Corporate Real Estate (CRE) teams make strategic decisions about space utilization, cost optimization, and employee experience improvements.

### Core Business Objectives

Our architecture must deliver on three critical business outcomes:

1. **Cost Reduction**: Enable clients to reduce real estate expenses by 15-25% through data-driven identification of underutilized spaces
2. **Employee Experience**: Improve workplace satisfaction by ensuring office layouts match actual usage patterns and hybrid work needs
3. **Strategic Planning**: Provide predictive analytics and executive insights to inform long-term real estate portfolio decisions

## Architectural Philosophy and Principles

### Multi-Tenancy as a First-Class Concern

Multi-tenancy isn't an afterthought in this architecture—it's the foundational principle that shapes every design decision. When building for enterprise clients, particularly in regulated industries like banking and finance, tenant isolation isn't just a technical requirement; it's a business imperative. A single data breach or tenant isolation failure could destroy customer trust and expose the company to massive liability.

We've chosen a **hybrid isolation model** that balances security, cost efficiency, and operational complexity:

**Shared Infrastructure, Logical Isolation**: All tenants share the same infrastructure (compute, storage, messaging) but are strictly isolated at the data and query level. This approach provides:
- **Cost Efficiency**: Resource pooling reduces infrastructure costs by 60-70% compared to dedicated infrastructure per tenant
- **Operational Simplicity**: Single deployment pipeline, unified monitoring, and centralized management
- **Strong Security**: Row-Level Security (RLS) and query-level filtering ensure tenants cannot access each other's data

**When Isolation Matters Most**: We apply additional isolation layers where security risks are highest:
- Database connections use tenant-scoped connection pools
- API gateway enforces tenant context validation before requests reach services
- Audit logs are tenant-separated to support individual compliance audits

### Why This Matters

Large enterprises won't adopt a SaaS platform unless they have confidence that their competitive intelligence (like which offices are being closed or expanded) remains completely confidential. Investment banks, in particular, demand proof of tenant isolation before they'll even begin a proof-of-concept.

## High-Level System Architecture

### Conceptual Architecture

The system follows a **layered microservices architecture** where each layer has a specific responsibility:

```
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway Layer                        │
│  (Authentication, Rate Limiting, Tenant Routing)            │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
│  Tenant Mgmt   │  │   Data Ingest   │  │    Analytics    │
│    Service     │  │     Service     │  │     Engine      │
└────────────────┘  └─────────────────┘  └─────────────────┘
        │                     │                     │
        │           ┌─────────┴────────┐           │
        │           │                  │           │
        ▼           ▼                  ▼           ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  PostgreSQL (Metadata) + InfluxDB (Time-Series) + Redis     │
└─────────────────────────────────────────────────────────────┘
```

### Why Microservices?

Microservices architecture might seem like overkill for an MVP, but it's the right choice for our context because:

1. **Team Scalability**: With 11 engineers, we need clear ownership boundaries. Each team owns specific services.
2. **Independent Deployment**: The analytics engine needs frequent updates with new algorithms; we can't risk destabilizing data ingestion.
3. **Technology Flexibility**: Time-series analysis benefits from specialized databases (InfluxDB), while tenant management needs transactional guarantees (PostgreSQL).
4. **Performance Isolation**: An AI model taking 10 seconds to generate recommendations shouldn't block real-time sensor data ingestion.

## Detailed Component Architecture

### 1. Data Ingestion Layer: Handling IoT at Scale

#### The Challenge

Our system must process occupancy data from approximately **1 million sensors** (5,000 sensors × 200 offices) generating events continuously. At typical occupancy sensing rates (one reading per minute), this translates to:
- **1,000,000 events per minute** during peak hours
- **1.4 billion events per day**
- **500+ billion events per year**

Traditional request-response APIs cannot handle this volume reliably. A sudden spike (like all offices reporting at the top of each hour) could overwhelm application servers, causing cascading failures.

#### Architectural Solution: Event-Driven Ingestion

**Technology Stack**: Apache Kafka + AWS IoT Core (or Azure IoT Hub)

**Why Kafka?**
Kafka provides the characteristics essential for IoT ingestion:

1. **Buffering and Backpressure**: If downstream systems slow down, Kafka queues messages without dropping data
2. **Horizontal Scalability**: Adding more Kafka partitions allows linear scaling to millions of messages per second
3. **Durability**: Messages persist to disk, surviving service restarts or temporary failures
4. **Replay Capability**: If analytics logic changes, we can reprocess historical data from Kafka's retention window

**Implementation Pattern**:

```
Sensors → IoT Gateway → Kafka Topics → Stream Processors → Databases
                       (by tenant)      (validate & enrich)
```

**Tenant Isolation in Data Ingestion**:
- Each tenant gets a dedicated Kafka topic (e.g., `occupancy.tenant-bank123`)
- Topic-level access control prevents cross-tenant data access
- Schema validation ensures data quality before processing
- Malformed data from one tenant doesn't affect others

**Scalability Design**:
- **Partitioning Strategy**: Topics are partitioned by office_id to ensure events from the same office are processed in order
- **Consumer Groups**: Multiple consumer instances process messages in parallel
- **Auto-scaling**: Consumer replicas scale based on Kafka lag metrics (if lag exceeds 10,000 messages, add consumers)

**Why Not REST APIs Directly?**
Direct REST APIs for sensor data would create several problems:
- **Retry Storms**: If a sensor loses connectivity and reconnects, retrying thousands of backlogged events could overwhelm servers
- **No Buffering**: Database slowdowns would immediately impact sensors
- **Lost Data**: If the API is down, sensor data is lost forever
- **Cost**: HTTP overhead is expensive at this scale; Kafka's binary protocol is far more efficient

### 2. API Gateway & Security Layer

The API Gateway is the **single entry point** for all client requests, serving as a security checkpoint, traffic manager, and routing controller.

#### Gateway Responsibilities

**1. Authentication & Authorization**
- JWT-based authentication with tenant context embedded in token claims
- Every request validated against tenant permissions before forwarding
- Support for multiple authentication methods (API keys for sensors, OAuth for integrations)

**2. Rate Limiting (Preventing Abuse)**
- **Per-tenant rate limits**: Prevents one tenant from consuming excessive resources
  - General API: 100 requests per 15 minutes per tenant
  - IoT Ingestion: 1,000 requests per minute per tenant (sensor data)
  - Analytics: 10 requests per minute (computationally expensive queries)
- **Adaptive throttling**: During system stress, limits tighten dynamically
- **Cost Protection**: Prevents runaway API usage from creating unexpected infrastructure costs

**3. Tenant Context Injection**
- After authenticating, gateway extracts tenant_id from JWT
- Injects tenant_id into request headers for downstream services
- Services use this to set database session variables for Row-Level Security

**4. Request Routing**
- Intelligent routing based on request path and tenant configuration
- Some tenants might route to dedicated infrastructure (compliance requirements)
- Circuit breaker pattern: If a service is failing, gateway returns cached responses or degrades gracefully

**Implementation Choice: Kong vs. AWS API Gateway**

**Kong (Open Source)**:
- Pros: Full control, runs on our Kubernetes cluster, extensive plugin ecosystem
- Cons: We maintain it (upgrades, security patches)
- Best for: Teams with strong DevOps capability, need for custom plugins

**AWS API Gateway (Managed)**:
- Pros: Zero maintenance, native AWS integration, automatic scaling
- Cons: Vendor lock-in, less customization flexibility
- Best for: Fast time-to-market, AWS-native architecture

**Recommendation**: Start with AWS API Gateway for MVP speed, migrate to Kong if customization needs grow.

### 3. Core Microservices

#### Tenant Management Service

This service is the **source of truth** for all tenant metadata, configuration, and billing information.

**Database Schema Design**:

```sql
-- Tenants table with strong isolation
CREATE TABLE tenants (
    tenant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    subscription_tier VARCHAR(50),
    data_retention_days INTEGER DEFAULT 730,
    created_at TIMESTAMP DEFAULT NOW(),
    compliance_requirements JSONB, -- SOC2, GDPR, etc.
    UNIQUE(tenant_name)
);

-- Offices belonging to tenants
CREATE TABLE offices (
    office_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    office_name VARCHAR(255) NOT NULL,
    country_code VARCHAR(2), -- For data residency
    capacity INTEGER,
    metadata JSONB -- Floor plans, address, timezone
);

-- Row-Level Security Policy
ALTER TABLE offices ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON offices
    FOR ALL TO application_role
    USING (tenant_id = current_setting('app.current_tenant')::UUID);
```

**Why Row-Level Security (RLS)?**

RLS is a database-native security feature that automatically filters queries based on policies. Here's why it's critical:

1. **Defense in Depth**: Even if application code has a bug, the database enforces isolation
2. **No SQL Injection Risk**: Tenant filtering happens at the PostgreSQL kernel level
3. **Simplified Application Code**: Developers don't need to remember to add `WHERE tenant_id = ?` to every query
4. **Audit Trail**: Database logs show RLS policy enforcement for compliance audits

**Before each database query**, application code sets the tenant context:
```javascript
await db.raw("SET app.current_tenant = ?", [tenantId]);
// All subsequent queries automatically filtered by tenant_id
```

#### Occupancy Data Service

This service handles the storage and retrieval of time-series occupancy data.

**Hybrid Database Strategy**:

We use **two databases** for occupancy data, each optimized for its workload:

**InfluxDB (Time-Series Database)**:
- **Purpose**: Store raw sensor readings
- **Why**: Purpose-built for time-series data with superior compression (10x better than PostgreSQL) and fast range queries
- **Data Structure**:
  ```
  Measurement: occupancy
  Tags: tenant_id, office_id, room_id, sensor_id
  Fields: people_count, temperature, humidity
  Timestamp: Event time (nanosecond precision)
  ```
- **Retention Policy**: 2 years hot storage, 7 years cold storage (compliance requirement)

**PostgreSQL (Relational)**:
- **Purpose**: Store room metadata, capacity, types
- **Why**: Complex joins (rooms + offices + tenants) need relational capabilities
- **Integration**: JOIN between PostgreSQL metadata and InfluxDB aggregations happens in application layer

**Why Not Use Just PostgreSQL?**

We evaluated using PostgreSQL with TimescaleDB extension (makes PostgreSQL better at time-series). While viable, InfluxDB provides:
- Better compression: 90% storage reduction for time-series data
- Faster downsampling: Continuous queries pre-aggregate data automatically
- Native retention policies: Automatic deletion of old data
- Optimized for write-heavy workloads: Sensors write constantly but read occasionally

**Trade-off**: Operational complexity of managing two database systems. However, managed InfluxDB Cloud reduces this burden significantly.

**Data Partitioning Strategy**:

Time-series data is partitioned by both **tenant** and **time**:
```
occupancy_2024_01_tenant_bank123
occupancy_2024_02_tenant_bank123
occupancy_2024_01_tenant_startup456
```

**Benefits**:
- **Fast Queries**: Queries for a specific tenant + month only scan one partition
- **Easy Deletion**: When a tenant churns, drop their partitions instantly
- **Cost Optimization**: Move old partitions to cheaper cold storage

#### Analytics Engine: Turning Data into Insights

The analytics engine is where raw occupancy numbers become business intelligence.

**Technology Stack**: Apache Spark + MLflow + Python

**Why Spark?**

Apache Spark is a distributed computing framework that allows us to process billions of events efficiently:

1. **Distributed Processing**: Calculations parallelize across multiple nodes
2. **In-Memory Computing**: Results cached in RAM for interactive queries
3. **Unified API**: Same code works for batch processing (nightly reports) and stream processing (real-time dashboards)
4. **Ecosystem**: Rich libraries for ML (MLlib), SQL, and graph processing

**Analytics Categories**:

**1. Real-Time Analytics** (Streaming):
- Current occupancy levels across all offices
- Utilization percentages updated every minute
- Alerts when occupancy exceeds thresholds

**Implementation**: Spark Structured Streaming consumes from Kafka, calculates rolling averages, writes to Redis cache

**2. Batch Analytics** (Historical):
- Weekly utilization trends
- Month-over-month comparisons
- Seasonal pattern identification

**Implementation**: Nightly Spark jobs read from InfluxDB, calculate aggregations, store results in PostgreSQL

**3. Predictive Analytics** (ML):
- Forecast next quarter's space needs based on historical patterns
- Identify which offices are likely to become over/under-utilized
- Anomaly detection (unusual occupancy patterns indicating issues)

**Implementation**: MLflow tracks experiments, Spark MLlib trains models, results served via REST API

**Example: Utilization Calculation**

```python
# Simplified pseudocode for utilization calculation
utilization = (
    occupancy_events
    .filter(tenant_id == "bank123")
    .filter(room_id == "confA")
    .filter(timestamp >= last_7_days)
    .groupBy(day)
    .agg(avg("people_count") as avg_occupancy)
    .agg(avg("avg_occupancy") / room_capacity as utilization_rate)
)
```

This query runs across potentially millions of events but returns in seconds thanks to Spark's distributed processing and InfluxDB's optimized storage.

#### Integration Service: Connecting the Ecosystem

Enterprises don't operate in isolation; our platform must integrate with their existing systems.

**Key Integrations**:

**1. HR Systems (Workday, SAP SuccessFactors)**
- **Purpose**: Correlate occupancy with headcount data
- **Example**: If NYC office has 500 employees but only 200 seats are used daily, recommend reducing space
- **Implementation**: OAuth 2.0 authentication, periodic sync of employee counts by office
- **Privacy**: Only aggregate headcount, never individual employee data

**2. Collaboration Tools (Microsoft Teams, Slack)**
- **Purpose**: Send proactive notifications and insights
- **Example**: "Your NYC office utilization dropped 15% this week. Click here to view details."
- **Implementation**: Webhook-based notifications triggered by analytics engine

**3. Calendar Systems (Microsoft Exchange, Google Workspace)**
- **Purpose**: Cross-reference meeting room bookings with actual occupancy
- **Insight**: "Conference Room A was booked but empty 40% of the time"
- **Implementation**: Calendar API integration with event subscription

**Security Architecture for Integrations**:
- **Credential Storage**: HashiCorp Vault for encrypted storage of OAuth tokens
- **Least Privilege**: Request minimum API scopes needed
- **Token Rotation**: Automatic refresh before expiration
- **Audit Logging**: Every integration call logged for security review

#### AI/ML Service: Natural Language and Recommendations

This service brings AI capabilities to the platform, enabling natural language queries and automated recommendations.

**Technology Stack**: Python/FastAPI + LangChain + OpenAI GPT-4 (or Anthropic Claude)

**Architecture Pattern**: LLM as a reasoning engine, not a data store

```
User Query → Intent Recognition → SQL Generation → Database Query →
Response Synthesis → Fact Verification → Natural Language Answer
```

**Why This Pattern?**

Direct LLM responses risk "hallucinations" (made-up facts). By using LLMs only for understanding queries and explaining results—while retrieving actual data from databases—we ensure accuracy.

**Example Interaction Flow**:

1. User asks: "Which conference rooms in EMEA are underutilized?"
2. LangChain parses intent: Query for rooms in EMEA region with utilization < threshold
3. Generate SQL:
   ```sql
   SELECT room_name, utilization_rate
   FROM room_utilization
   WHERE region = 'EMEA' AND utilization_rate < 0.5
   ORDER BY utilization_rate ASC;
   ```
4. Execute query, retrieve results
5. LLM generates human-readable response:
   "I found 12 conference rooms in EMEA with below 50% utilization. The least utilized is Conference Room A in London at 23%, representing a potential saving of £15K/month..."

**Safety Mechanisms**:
- **Query Validation**: Generated SQL reviewed by security rules before execution
- **Fact Grounding**: Every claim includes source data reference
- **Confidence Scores**: Responses marked with confidence levels
- **Human Review**: Critical recommendations require facilities manager approval

### 4. Data Storage Architecture Deep Dive

#### Multi-Tenancy Data Isolation Strategies

There are three common approaches to multi-tenant data isolation, each with trade-offs:

**Option 1: Shared Database, Shared Schema** (Our Choice)
- All tenants in one database, tenant_id column on every table
- Pros: Cost efficient, easy backups, simple operations
- Cons: Requires perfect query filtering, risk of developer mistakes
- Mitigation: Row-Level Security (RLS) enforces isolation at database level

**Option 2: Shared Database, Isolated Schemas**
- Each tenant gets their own PostgreSQL schema
- Pros: Better isolation than shared schema, moderate cost
- Cons: Managing thousands of schemas complex, migration challenges

**Option 3: Database Per Tenant**
- Each tenant gets a dedicated database instance
- Pros: Perfect isolation, can customize per tenant
- Cons: Expensive (hundreds of databases), operational nightmare

**Our Decision: Shared Database + RLS**

For a B2B SaaS targeting hundreds of enterprise customers, Option 1 with RLS provides the best balance. Here's why:

- **Cost**: At $500/month per PostgreSQL instance, 100 tenants would cost $50K/month with database-per-tenant (Option 3). Shared database costs $2-3K/month total.
- **Backup Efficiency**: Single backup covers all tenants
- **Cross-Tenant Analytics**: We can provide benchmarking features ("Your utilization is 20% better than industry average")
- **Security**: RLS provides strong guarantees when implemented correctly

**When We'd Reconsider**: If a massive enterprise (e.g., JP Morgan) demands dedicated infrastructure for compliance, we'd architect for tenant-specific deployments.

#### Time-Series Data Optimization

InfluxDB's data model is optimized for IoT workloads through several techniques:

**1. Compression**:
- Delta encoding: Store differences between values, not absolute values
- Run-length encoding: Repeated values stored efficiently
- Result: 500GB of raw data compresses to ~50GB

**2. Downsampling**:
- Raw data: Keep 30 days at full resolution (1-minute intervals)
- Downsampled: After 30 days, aggregate to 15-minute averages
- Long-term: After 1 year, aggregate to hourly averages
- Storage savings: 90% reduction while preserving trend visibility

**3. Continuous Queries**:
InfluxDB automatically pre-computes aggregations:
```sql
-- Automatically calculate hourly averages
CREATE CONTINUOUS QUERY "cq_hourly_avg" ON "workplace_analytics"
BEGIN
  SELECT mean("people_count")
  INTO "occupancy_hourly"
  FROM "occupancy"
  GROUP BY time(1h), tenant_id, room_id
END
```

**Why This Matters**: When a user requests a 90-day utilization report, the system queries pre-aggregated hourly data (2,160 data points) instead of raw minutely data (129,600 data points), reducing query time from 30 seconds to under 1 second.

### 5. Security & Compliance Architecture

#### SOC2 Type II Compliance

SOC2 is an auditing standard for service providers storing customer data. Type II specifically requires demonstrating controls over time, not just having them in place.

**Key SOC2 Requirements and Our Implementation**:

**1. Security Controls**:
- **Requirement**: Data encrypted at rest and in transit
- **Implementation**:
  - Database: AES-256 encryption for all volumes
  - Network: TLS 1.3 for all API communication
  - Secrets: HashiCorp Vault for credential management
- **Verification**: Annual third-party security audit

**2. Availability**:
- **Requirement**: 99.9% uptime guarantee
- **Implementation**:
  - Multi-AZ database deployments (automatic failover)
  - Load balancer health checks with automatic instance replacement
  - Chaos engineering tests (randomly kill services to verify resilience)
- **Monitoring**: Real-time SLA tracking with executive dashboards

**3. Processing Integrity**:
- **Requirement**: Data processed accurately and completely
- **Implementation**:
  - Schema validation on ingestion
  - Checksums to detect data corruption
  - Reconciliation jobs comparing input vs. stored event counts
- **Auditing**: Monthly data integrity reports

**4. Confidentiality**:
- **Requirement**: Tenant data never leaks to other tenants
- **Implementation**:
  - Row-Level Security on all tables
  - Tenant-scoped API authentication
  - Regular penetration testing
- **Verification**: Security researcher bug bounty program

**5. Privacy**:
- **Requirement**: Personal data handled appropriately
- **Implementation**:
  - Anonymized occupancy data (no individual tracking)
  - Data retention policies with automatic deletion
  - Privacy impact assessments for new features

#### GDPR Compliance

The EU's General Data Protection Regulation imposes strict requirements on personal data handling.

**GDPR Principles Applied to Our System**:

**1. Data Minimization**:
- **Principle**: Only collect necessary data
- **Our Approach**: Occupancy sensors count people, never identify individuals
- **Example**: We store "Conference Room A had 5 people at 2pm" NOT "John, Sarah, Mike, Emma, and David were in Conference Room A"

**2. Purpose Limitation**:
- **Principle**: Data only used for stated purposes
- **Our Approach**: Occupancy data only for space optimization, never employee monitoring
- **Safeguard**: Contracts explicitly prohibit using data for employee performance tracking

**3. Right to Erasure** ("Right to be Forgotten"):
- **Requirement**: Delete data on request
- **Implementation**:
  - API endpoint: `DELETE /api/tenants/:tenant_id` (soft delete marks for deletion)
  - Background job: Hard delete after 30-day grace period
  - Backup retention: Exclude deleted tenants from new backups
- **Challenge**: Time-series data in InfluxDB doesn't support efficient deletes
- **Solution**: Partition by tenant, drop entire partitions on deletion

**4. Data Residency**:
- **Requirement**: EU citizens' data must stay in EU
- **Implementation**:
  - Multi-region architecture: `eu-west-1` region for EU tenants
  - Tenant configuration: `data_region` field enforces storage location
  - Database routing: Application routes queries to correct region
  - Compliance audit**: Generate reports showing data never left region

**5. Breach Notification**:
- **Requirement**: Report breaches within 72 hours
- **Implementation**:
  - Automated detection: Anomaly detection on data access patterns
  - Runbook: Pre-defined incident response procedures
  - Notification system: Automated customer emails + regulatory reporting

### 6. Scalability & Performance Architecture

#### Multi-Region Deployment Strategy

**Geographic Distribution**:
- **Primary Regions**: `us-east-1` (US), `eu-west-1` (Europe), `ap-southeast-1` (Asia-Pacific)
- **Rationale**: Covers major markets with low latency (<100ms)

**Active-Active Architecture**:
Each region is fully operational and serves local traffic:
```
User (London) → API Gateway (eu-west-1) → Services (eu-west-1) → Database (eu-west-1)
User (New York) → API Gateway (us-east-1) → Services (us-east-1) → Database (us-east-1)
```

**Benefits**:
- **Low Latency**: Users connect to nearest region
- **High Availability**: If one region fails, others continue operating
- **Data Residency**: EU data stays in EU (GDPR requirement)

**Challenges**:
- **Cross-Region Analytics**: Benchmarking requires aggregating data across regions
- **Solution**: Nightly data synchronization to analytics warehouse, anonymized and aggregated

#### Auto-Scaling Architecture

**Horizontal Pod Autoscaling (HPA)**: Kubernetes automatically adjusts service replicas based on metrics

**Scaling Metrics**:
- **CPU**: Scale up when average CPU > 70% for 2 minutes
- **Memory**: Scale up when memory > 80%
- **Custom**: Scale up when request queue depth > 100

**Example Configuration**:
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: occupancy-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: occupancy-service
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

**Scaling Behavior**:
- **Scale Up**: Add 50% more pods (e.g., 4 → 6) when threshold breached
- **Scale Down**: Remove pods gradually (one every 5 minutes) to avoid thrashing
- **Cooldown**: Wait 3 minutes after scaling before next action

**Database Scaling**:
- **Read Replicas**: Route analytics queries to read replicas, writes to primary
- **Connection Pooling**: PgBouncer manages connections efficiently
- **Vertical Scaling**: Increase database instance size for primary during high load

#### Caching Strategy for Performance

**Three-Layer Caching**:

**1. Application Cache (Redis)**:
- **TTL**: 1-4 hours depending on data freshness requirements
- **Cache Keys**: `utilization:{tenant_id}:{room_id}:{days}`
- **Invalidation**: On new data ingestion, invalidate affected keys
- **Hit Rate Target**: 85%+ (reduces database load by 6x)

**2. Database Query Cache**:
- PostgreSQL automatically caches frequently run queries
- InfluxDB caches recent time ranges

**3. CDN Cache (CloudFront)**:
- Static assets (dashboards, charts) cached at edge locations
- 90%+ of requests served from CDN, reducing origin load

**Cache Warming**:
- Pre-populate cache with common queries during off-peak hours
- Example: Calculate yesterday's utilization for all tenants at 2 AM

### 7. Observability & Monitoring

A distributed system is only as reliable as your ability to understand what's happening inside it.

**Metrics, Logs, and Traces (The Three Pillars)**:

**1. Metrics (Prometheus + Grafana)**:
- **What**: Numerical measurements over time
- **Examples**: Request rate, error rate, latency, CPU usage
- **Dashboards**: Real-time graphs showing system health
- **Alerts**: Trigger when metrics cross thresholds

**Key Metrics We Track**:
- **Business**: Active tenants, data ingestion rate, API usage
- **Technical**: Service latency (p50, p95, p99), error rates, database connections
- **Infrastructure**: CPU, memory, disk I/O, network throughput

**2. Logs (Elasticsearch + Logstash + Kibana = ELK)**:
- **What**: Text records of events that happened
- **Examples**: "User 123 logged in", "Query took 2.5s", "Database connection failed"
- **Structured Logging**: JSON format for easy parsing
  ```json
  {
    "timestamp": "2025-01-15T10:23:45Z",
    "level": "ERROR",
    "tenant_id": "bank123",
    "message": "Database query timeout",
    "duration_ms": 5000,
    "query": "SELECT * FROM rooms WHERE..."
  }
  ```
- **Correlation IDs**: Track a single request across multiple services

**3. Traces (Jaeger)**:
- **What**: Visual representation of a request's journey through the system
- **Example**: API request → Gateway → Auth Service → Occupancy Service → Database
- **Use Case**: Identify which service in the chain is slow

**Example Trace**:
```
[API Gateway: 5ms] → [Auth: 10ms] → [Occupancy Service: 200ms]
                                      ↳ [Database Query: 180ms] ← BOTTLENECK!
```

**Alerting Philosophy**:
- **On-Call**: Only page engineers for critical, customer-impacting issues
- **Warning**: Email/Slack for issues that might become critical
- **Info**: Log for analysis but don't alert

**Sample Alerts**:
- **Critical**: API error rate > 5% for 5 minutes (page on-call)
- **Warning**: Database connections > 90% (email DevOps)
- **Info**: Unusual traffic pattern detected (log for analysis)

## Key Design Decisions & Rationale

### 1. Why Microservices Over Monolith?

**Monolith Advantages**:
- Simpler deployment (one artifact)
- Easier local development
- No network calls between components

**Why We Chose Microservices**:
- **Team Scalability**: 11 engineers need clear ownership; microservices create natural boundaries
- **Independent Deployment**: Analytics team can deploy ML models without coordinating with data ingestion team
- **Technology Flexibility**: Use InfluxDB for time-series, PostgreSQL for relational, without constraints
- **Fault Isolation**: AI service crashing doesn't bring down data ingestion

**When We'd Choose Monolith**: If this were a 2-3 person team building an MVP, monolith's simplicity would outweigh microservices' benefits.

### 2. Kafka vs SQS/SNS for Message Queue

**AWS SQS/SNS**: Managed message queue service
- Pros: Zero maintenance, automatic scaling, AWS-native
- Cons: Limited throughput (3,000 msg/s per queue), no message replay

**Apache Kafka**: Distributed streaming platform
- Pros: Unlimited throughput, message replay for reprocessing, rich ecosystem
- Cons: Requires management (or use Confluent Cloud)

**Our Choice**: Kafka for IoT ingestion, SQS for internal service communication

**Rationale**: IoT data needs Kafka's throughput and replay capabilities. Internal service messages (e.g., "tenant created") have lower volume and benefit from SQS's simplicity.

### 3. API-First AI vs Self-Hosted Models

**Self-Hosted Models** (Train our own LLMs):
- Pros: No per-token costs, full control, data never leaves infrastructure
- Cons: Requires ML expertise, GPU infrastructure, months of training

**API-First** (OpenAI, Anthropic):
- Pros: Best-in-class models immediately, zero infrastructure, rapid iteration
- Cons: Per-token costs, vendor dependency, data sent to third party

**Our Choice**: API-First with OpenAI/Anthropic

**Rationale**:
1. Time-to-market: API integration takes days vs. months for self-hosting
2. Quality: GPT-4/Claude outperform anything we could train with our data volume
3. Cost: At expected query volume (10K/month), API costs are ~$500/month vs. $5K+ for GPU infrastructure
4. Privacy: We only send aggregated statistics to LLMs, never raw occupancy data

**Future**: If query volume exceeds 1M/month, revisit self-hosting to reduce per-token costs.

### 4. Shared Infrastructure vs Dedicated Per Tenant

**Dedicated Infrastructure**:
- Pros: Perfect isolation, customizable per tenant
- Cons: High costs, operational complexity

**Shared Infrastructure**:
- Pros: Cost efficient, easier operations
- Cons: Noisy neighbor risk, requires strong isolation

**Our Choice**: Shared infrastructure with logical isolation + option for dedicated

**Rationale**: Most tenants are cost-conscious and accept shared infrastructure with proven isolation. Large enterprises (e.g., Goldman Sachs) pay premium for dedicated infrastructure.

**Hybrid Approach**:
- **Standard Tier**: Shared infrastructure ($5K/month)
- **Enterprise Tier**: Dedicated database + compute ($25K/month)

## Non-Functional Requirements

### Performance SLAs

- **API Latency**: 95th percentile < 200ms for simple queries, < 2s for complex analytics
- **Data Ingestion**: Process 1M events/minute with < 30s delay from sensor to database
- **Dashboard Load Time**: < 3 seconds for initial render
- **Query Concurrency**: Support 1,000 concurrent users per tenant

### Availability & Reliability

- **Uptime SLA**: 99.9% (< 8.76 hours downtime/year)
- **Disaster Recovery**: RTO < 1 hour, RPO < 15 minutes
- **Zero-Downtime Deployments**: Blue-green deployment strategy

### Security Standards

- **Encryption**: AES-256 at rest, TLS 1.3 in transit
- **Authentication**: JWT with 24-hour expiry, refresh tokens
- **Auditing**: Every data access logged with tenant_id, user, timestamp
- **Penetration Testing**: Quarterly security assessments

## Conclusion: Why This Architecture Succeeds

This architecture balances **ambitious technical goals with pragmatic constraints**:

1. **Enterprise-Ready**: Meets SOC2, GDPR, and Fortune 500 security requirements
2. **Cost-Effective**: Shared infrastructure keeps costs reasonable for mid-market customers
3. **Scalable**: Handles growth from 10 tenants to 1,000+ without redesign
4. **Team-Friendly**: Clear service boundaries allow 11 engineers to work independently
5. **Future-Proof**: Microservices architecture allows technology swaps as needs evolve

The key insight is that **multi-tenancy drives every decision**. From Row-Level Security in databases to Kafka topic-per-tenant isolation to tenant-aware caching, we've designed isolation into every layer. This isn't over-engineering; it's the foundation of enterprise trust.

By starting with a solid architectural foundation, we can iterate rapidly on features while maintaining the security, compliance, and reliability that enterprise customers demand. This is the difference between a side project and production-grade SaaS.
