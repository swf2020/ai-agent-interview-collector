# 后端开发 社招面试题集（采集日期：2026-05-16）

> 来源：小红书 / B站 / 牛客 / CSDN / 阿里云开发者社区 / 掘金 / InfoQ / 百度开发者 等
> 本次新增：200 题 | 累计去重后：200 题
> 采集范围：2025年11月 - 2026年5月 | 角色：后端开发工程师

---

## 🎯 Module 1：Java基础与JVM

[Module 1] [来源:小红书][互联网公司|京东|综合][2026-05] 请简述 Java JVM 的内存区域划分，以及 JDK 8 之后永久代被元空间替代的原因。 → 详见 [解答](answers/module_01_java_jvm.md#Q1)

[Module 1] [来源:小红书/牛客][互联网公司|腾讯/字节跳动|一面][2026-04] Java 程序运行时，JVM 内存分为哪几块？堆里的对象是一定会被回收的吗？引用类型会被回收吗？ → 详见 [解答](answers/module_01_java_jvm.md#Q2)

[Module 1] [来源:牛客][互联网公司|腾讯|一面][2025-11] Java分代设计是什么？不同代的GC机制分别是什么？ → 详见 [解答](answers/module_01_java_jvm.md#Q3)

[Module 1] [来源:小红书/牛客][互联网公司|拼多多/美团|一面][2025-12/2026-01] Java为什么要设计成分代回收机制？新生代和老年代分别用什么清除算法？默认比例是多少？ → 详见 [解答](answers/module_01_java_jvm.md#Q4)

[Module 1] [来源:小红书][互联网公司|拼多多|一面][2025-12] 讲一讲Java的G1垃圾收集器，它与CMS、ZGC的主要区别和适用场景是什么？ → 详见 [解答](answers/module_01_java_jvm.md#Q5)

[Module 1] [来源:多平台][其他|未知|综合][2026-Q1] JDK 21分代ZGC相比G1有什么区别？ → 详见 [解答](answers/module_01_java_jvm.md#Q6)

[Module 1] [来源:牛客][其他|招银网络科技|一面][2025-12] 了解哪些垃圾回收算法？ → 详见 [解答](answers/module_01_java_jvm.md#Q7)

[Module 1] [来源:小红书/牛客][互联网公司|拼多多/字节跳动|一面][2025-12] 简述JVM的类加载机制。双亲委派模型是什么？如何自定义一个类加载器？打破双亲委派模型有哪些方式？ → 详见 [解答](answers/module_01_java_jvm.md#Q8)

[Module 1] [来源:小红书][互联网公司|字节跳动|一面][2026-04] ==和equals的区别？hashCode和equals的关系和区别是什么？ → 详见 [解答](answers/module_01_java_jvm.md#Q9)

[Module 1] [来源:小红书/牛客][互联网公司|京东/字节跳动|综合/一面][2026-05/2025-12] HashMap的底层数据结构是什么？如何扩容？为什么在 JDK 8 中引入红黑树？HashMap怎么计算桶位？ → 详见 [解答](answers/module_01_java_jvm.md#Q10)

[Module 1] [来源:牛客][互联网公司|美团|一面][2026-01] Java中如何在不重启JVM的情况下修改一个类的结构？（HotSwap） → 详见 [解答](answers/module_01_java_jvm.md#Q11)

[Module 1] [来源:小红书][互联网公司|拼多多|一面][2025-12] 什么是逃逸分析？它在JVM优化中扮演什么角色？ → 详见 [解答](answers/module_01_java_jvm.md#Q12)

[Module 1] [来源:小红书/牛客][互联网公司|阿里巴巴/快手|一面][2026-04/2026-05] OOM了如何排查？OOM是异常吗？能捕捉自己处理让程序不退出吗？ → 详见 [解答](answers/module_01_java_jvm.md#Q13)

---

## 🎯 Module 2：并发编程

[Module 2] [来源:小红书][互联网公司|拼多多|一面][2025-12] volatile关键字如何保证内存可见性和禁止指令重排？它的底层是如何实现的？ → 详见 [解答](answers/module_02_concurrency.md#Q1)

[Module 2] [来源:牛客][互联网公司|字节跳动|一面][2025-12] CAS和普通加锁的优劣是什么？互斥锁与自旋锁的区别是什么？ → 详见 [解答](answers/module_02_concurrency.md#Q2)

[Module 2] [来源:小红书][互联网公司|京东|综合][2026-05] 解释一下 CAS 原理及 ABA 问题，你在实际项目中有没有用到过原子类？ → 详见 [解答](answers/module_02_concurrency.md#Q3)

[Module 2] [来源:牛客][互联网公司|字节跳动|一面][2025-12] synchronized锁升级的过程是怎样的？为什么会有这个过程？ → 详见 [解答](answers/module_02_concurrency.md#Q4)

[Module 2] [来源:牛客/B站][互联网公司|字节跳动/未知|一面/综合][2025-12/2026-05] ReentrantLock和synchronized的区别？生产上一般用哪个？AQS的实现原理是什么？有哪些实现类？ → 详见 [解答](answers/module_02_concurrency.md#Q5)

[Module 2] [来源:百度开发者][其他|未知|综合][2025-12] 如何基于AQS实现自定义锁？读写锁的公平性如何保证？锁降级的实现原理？ → 详见 [解答](answers/module_02_concurrency.md#Q6)

[Module 2] [来源:小红书][互联网公司|京东|综合][2026-05] 什么是线程池的饱和策略？你会如何配置核心线程数？ → 详见 [解答](answers/module_02_concurrency.md#Q7)

[Module 2] [来源:牛客][互联网公司|腾讯|一面][2025-11] 线程池最大线程数什么时候能拉满？CallerRunsPolicy有什么风险？ → 详见 [解答](answers/module_02_concurrency.md#Q8)

[Module 2] [来源:牛客][互联网公司|快手|一面][2026-05] 创建线程有几种方式？Java中线程间数据同步怎么做？ → 详见 [解答](answers/module_02_concurrency.md#Q9)

[Module 2] [来源:牛客][互联网公司|快手|一面][2026-05] Thread对象、虚拟线程和操作系统线程的对应关系？线程崩掉后是整个进程退出，还是可由其他线程捕获处理？ → 详见 [解答](answers/module_02_concurrency.md#Q10)

[Module 2] [来源:多平台][其他|未知|综合][2026-Q1] 虚拟线程（Virtual Thread）与平台线程的区别？使用场景？ → 详见 [解答](answers/module_02_concurrency.md#Q11)

[Module 2] [来源:小红书][互联网公司|京东|综合][2026-05] 在多线程环境下，如何保证一个变量的可见性与有序性？ → 详见 [解答](answers/module_02_concurrency.md#Q12)

[Module 2] [来源:牛客][互联网公司|快手|一面][2026-05] synchronized加锁后临界区抛出OOM或异常，锁自动释放还是手动处理？ → 详见 [解答](answers/module_02_concurrency.md#Q13)

[Module 2] [来源:小红书][互联网公司|拼多多|一面][2025-12] 谈一谈你对CompletableFuture的理解。与Future相比，它解决了哪些痛点？ → 详见 [解答](answers/module_02_concurrency.md#Q14)

[Module 2] [来源:牛客][互联网公司|阿里巴巴|二面][2025-11] 多个子线程全部运行完后主线程才能往下走，有几种实现方式？CountDownLatch底层怎么实现？ → 详见 [解答](answers/module_02_concurrency.md#Q15)

[Module 2] [来源:牛客][互联网公司|阿里巴巴|一面][2025-11] ThreadLocal是什么？为什么使用？会产生什么问题？ → 详见 [解答](answers/module_02_concurrency.md#Q16)

---

## 🎯 Module 3：数据库与存储

[Module 3] [来源:小红书/牛客][互联网公司|字节跳动/京东|一面/综合][2026-04/2026-05] MySQL InnoDB的索引是什么数据结构？为什么默认使用B+树作为索引结构，而不是红黑树或哈希表？ → 详见 [解答](answers/module_03_database.md#Q1)

[Module 3] [来源:牛客][互联网公司|腾讯|一面][2026-04] B+树和B树的区别是什么？ → 详见 [解答](answers/module_03_database.md#Q2)

[Module 3] [来源:小红书][互联网公司|京东|综合][2026-05] 解释聚簇索引与非聚簇索引的区别，什么情况下会发生"回表"？ → 详见 [解答](answers/module_03_database.md#Q3)

[Module 3] [来源:小红书][互联网公司|字节跳动|一面][2026-04] 联合索引是什么？比如建了(a,b,c)，查a c能用索引吗？ → 详见 [解答](answers/module_03_database.md#Q4)

[Module 3] [来源:小红书/牛客][互联网公司|字节跳动|一面][2025-12] 联合索引和最左前缀匹配原则是什么？索引失效是由什么原因导致的？ → 详见 [解答](answers/module_03_database.md#Q5)

[Module 3] [来源:小红书/牛客][互联网公司|京东/熙牛|综合/二面][2026-05/2026-04] 联合索引(a,b,c)下，WHERE a=? ORDER BY c 和 ORDER BY b 的索引使用情况分别如何？ → 详见 [解答](answers/module_03_database.md#Q6)

[Module 3] [来源:小红书][互联网公司|京东|综合][2026-05] 谈谈你对索引下推 (ICP) 和覆盖索引的理解。 → 详见 [解答](answers/module_03_database.md#Q7)

[Module 3] [来源:小红书][互联网公司|京东|综合][2026-05] 大表翻页优化：当 Limit 数值很大时性能骤降，你会如何改写 SQL？ → 详见 [解答](answers/module_03_database.md#Q8)

[Module 3] [来源:牛客][互联网公司|腾讯|一面][2025-11] 加索引能否解决深分页问题？ → 详见 [解答](answers/module_03_database.md#Q9)

[Module 3] [来源:B站][其他|未知|综合][2026-05] Explain用过吗？有哪些主要字段？创建索引有哪些注意点？ → 详见 [解答](answers/module_03_database.md#Q10)

[Module 3] [来源:小红书][互联网公司|腾讯|一面][2026-04] 有用户表、签到表（自增ID, user_id, 签到时间, 状态），要查某个用户某个月的签到记录，怎么加索引？ → 详见 [解答](answers/module_03_database.md#Q11)

[Module 3] [来源:牛客][互联网公司|Shopee|一面][2025-11] MySQL索引失效的情况有哪些？LIKE '%%'内部发生了什么？ → 详见 [解答](answers/module_03_database.md#Q12)

[Module 3] [来源:小红书][互联网公司|字节跳动|一面][2026-04] 事务隔离级别有哪些？它们分别解决什么问题？ → 详见 [解答](answers/module_03_database.md#Q13)

[Module 3] [来源:小红书/牛客][互联网公司|京东/腾讯|综合/一面][2026-05/2025-11] MySQL默认隔离级别是什么？有没有解决幻读？如何解决的？ → 详见 [解答](answers/module_03_database.md#Q14)

[Module 3] [来源:小红书][互联网公司|京东|综合][2026-05] 什么是 MVCC (多版本并发控制)？它是如何通过 Undo Log 实现的？ → 详见 [解答](answers/module_03_database.md#Q15)

[Module 3] [来源:CSDN][互联网公司|得物|一面][2026-05] MVCC能解决脏读和幻读吗？ → 详见 [解答](answers/module_03_database.md#Q16)

[Module 3] [来源:牛客][互联网公司|Shopee|一面][2025-11] 脏读和不可重复读的区别？MySQL ACID的一致性是什么？一致性和另外三个的关系？ → 详见 [解答](answers/module_03_database.md#Q17)

[Module 3] [来源:CSDN][互联网公司|蚂蚁集团|二面][2026-05] 数据库ACID四个特性分别是怎么去实现的？ → 详见 [解答](answers/module_03_database.md#Q18)

[Module 3] [来源:牛客][互联网公司|字节跳动|一面][2025-12] MySQL的原子性是怎么保证的？ → 详见 [解答](answers/module_03_database.md#Q19)

[Module 3] [来源:小红书][互联网公司|字节跳动|二面][2026-05] MySQL UPDATE 语句执行流程是怎样的？ → 详见 [解答](answers/module_03_database.md#Q20)

[Module 3] [来源:小红书][互联网公司|字节跳动|二面][2026-05] undolog redolog binlog 如何写入磁盘？ → 详见 [解答](answers/module_03_database.md#Q21)

[Module 3] [来源:牛客][互联网公司|字节跳动|一面][2025-12] redolog和binlog如何写入磁盘？两阶段提交是什么？如果没有两阶段提交会怎么样？ → 详见 [解答](answers/module_03_database.md#Q22)

[Module 3] [来源:牛客][互联网公司|美团|一面][2026-01] MySQL有哪些日志？ → 详见 [解答](answers/module_03_database.md#Q23)

[Module 3] [来源:小红书][互联网公司|京东|综合][2026-05] 如果一条 SQL 语句执行很慢，你通常会从哪些维度进行分析和优化？ → 详见 [解答](answers/module_03_database.md#Q24)

[Module 3] [来源:小红书][互联网公司|京东|综合][2026-05] 在高并发场景下，如何防止数据库产生死锁？ → 详见 [解答](answers/module_03_database.md#Q25)

[Module 3] [来源:小红书][互联网公司|字节跳动|二面][2026-05] 如何在 MySQL 层面提升并发量？ → 详见 [解答](answers/module_03_database.md#Q26)

[Module 3] [来源:小红书][互联网公司|腾讯|一面][2026-04] 如果不用 Redis，直接在 MySQL 层面避免高并发下的重复点赞，怎么设计？ → 详见 [解答](answers/module_03_database.md#Q27)

[Module 3] [来源:小红书][互联网公司|腾讯|一面][2026-04] 如果并发量很大，乐观锁和悲观锁的区别？使用悲观锁有什么问题？ → 详见 [解答](answers/module_03_database.md#Q28)

[Module 3] [来源:CSDN][互联网公司|蚂蚁集团|二面][2026-05] 怎么用MySQL实现分布式锁？ → 详见 [解答](answers/module_03_database.md#Q29)

[Module 3] [来源:牛客][互联网公司|阿里巴巴|二面][2025-11] 做表连接时，查询条件写在where后面和写在Join后面有什么区别？ → 详见 [解答](answers/module_03_database.md#Q30)

[Module 3] [来源:牛客][互联网公司|美团|一面][2026-01] 分库分表的分表键是怎么设计的？为什么分128张表？ → 详见 [解答](answers/module_03_database.md#Q31)

---

## 🎯 Module 4：缓存与消息队列

[Module 4] [来源:小红书/牛客][互联网公司|字节跳动/京东|一面/综合][2026-04/2026-05] Redis为什么快？单线程模型怎么理解？在最新版本中引入多线程是为了解决什么问题？ → 详见 [解答](answers/module_04_cache_mq.md#Q1)

[Module 4] [来源:牛客][互联网公司|字节跳动|一面][2025-12] Redis的网络模型是怎么样的？ → 详见 [解答](answers/module_04_cache_mq.md#Q2)

[Module 4] [来源:小红书][互联网公司|京东|综合][2026-05] Redis 的核心数据结构有哪些？请谈谈跳跃表 (ZSet) 的实现原理。 → 详见 [解答](answers/module_04_cache_mq.md#Q3)

[Module 4] [来源:小红书][互联网公司|腾讯|一面][2026-04] HyperLogLog、ZSet、Bitmap 的底层原理和适用场景是什么？ → 详见 [解答](answers/module_04_cache_mq.md#Q4)

[Module 4] [来源:小红书][互联网公司|腾讯|一面][2026-04] 如何统计最近七天内每天都活跃的日活用户交集？ → 详见 [解答](answers/module_04_cache_mq.md#Q5)

[Module 4] [来源:小红书][互联网公司|字节跳动/京东|一面/综合][2026-04/2026-05] 缓存穿透、击穿和雪崩分别是什么？如何解决？ → 详见 [解答](answers/module_04_cache_mq.md#Q6)

[Module 4] [来源:小红书][互联网公司|腾讯|一面][2026-04] 布隆过滤器的原理是什么？布隆过滤器、互斥锁、逻辑过期分别是解决什么问题的？ → 详见 [解答](answers/module_04_cache_mq.md#Q7)

[Module 4] [来源:小红书][互联网公司|腾讯|一面][2026-04] 逻辑过期和物理过期的区别是什么？ → 详见 [解答](answers/module_04_cache_mq.md#Q8)

[Module 4] [来源:小红书][互联网公司|京东|综合][2026-05] 谈谈什么是布隆过滤器，它在过滤无效请求时的优缺点是什么？ → 详见 [解答](answers/module_04_cache_mq.md#Q9)

[Module 4] [来源:牛客][互联网公司|熙牛|二面][2026-04] 缓存击穿及解决方案？锁内二次判断是否必要？ → 详见 [解答](answers/module_04_cache_mq.md#Q10)

[Module 4] [来源:小红书/牛客][互联网公司|字节跳动/京东|一面/综合][2026-04/2026-05] MySQL和Redis的数据一致性怎么保证？延迟双删有什么问题？为什么不先删缓存？ → 详见 [解答](answers/module_04_cache_mq.md#Q11)

[Module 4] [来源:小红书][其他|未知|综合][2026-04] Redis+MySQL数据一致性的4种方案分别适用于什么场景？ → 详见 [解答](answers/module_04_cache_mq.md#Q12)

[Module 4] [来源:牛客][互联网公司|阿里巴巴|一面][2025-11] 修改数据库成功但Redis失败，前端返回什么响应？怎么处理？ → 详见 [解答](answers/module_04_cache_mq.md#Q13)

[Module 4] [来源:小红书][互联网公司|京东|综合][2026-05] Redis的持久化机制：RDB vs AOF 如何配置？ → 详见 [解答](answers/module_04_cache_mq.md#Q14)

[Module 4] [来源:小红书][互联网公司|京东|综合][2026-05] 解释分布式锁的几种实现方式，Redisson 如何解决锁过期但任务未执行完的问题？ → 详见 [解答](answers/module_04_cache_mq.md#Q15)

[Module 4] [来源:牛客][互联网公司|熙牛|二面][2026-04] Redisson看门狗机制是什么？底层实现如何？分布式锁误删如何发生？如何避免？ → 详见 [解答](answers/module_04_cache_mq.md#Q16)

[Module 4] [来源:牛客][互联网公司|美团|一面][2026-01] 分布式锁的超时时间设为多少？为什么？看门狗机制如果有1000个线程需要1000个守护线程吗？ → 详见 [解答](answers/module_04_cache_mq.md#Q17)

[Module 4] [来源:牛客][互联网公司|阿里巴巴|一面][2025-11] Redis+Lua脚本分布式锁怎么实现的？ → 详见 [解答](answers/module_04_cache_mq.md#Q18)

[Module 4] [来源:掘金][其他|未知|综合][2025-11] Redis的热点Key问题你怎么解决？为什么一定要Double Check？如果锁竞争非常激烈怎么办？ → 详见 [解答](answers/module_04_cache_mq.md#Q19)

[Module 4] [来源:牛客][互联网公司|快手|一面][2026-05] Redis集群部署节点后，key怎么定位到节点？双副本及单副本节点挂了之后访问情况？ → 详见 [解答](answers/module_04_cache_mq.md#Q20)

[Module 4] [来源:小红书][互联网公司|京东|综合][2026-05] 如何在不影响线上业务的情况下，对千万级 Key 的 Redis 实例进行迁移？ → 详见 [解答](answers/module_04_cache_mq.md#Q21)

[Module 4] [来源:牛客][互联网公司|字节跳动|一面][2026-04] 缓存有TTL吗？大量key同时过期怎么办？ → 详见 [解答](answers/module_04_cache_mq.md#Q22)

[Module 4] [来源:牛客][互联网公司|字节跳动|一面][2025-12] Kafka为什么那么快？Kafka为什么能实现高吞吐？ → 详见 [解答](answers/module_04_cache_mq.md#Q23)

[Module 4] [来源:CSDN][其他|未知|综合][2025-12] Kafka的ISR机制是什么？Leader选举流程？ → 详见 [解答](answers/module_04_cache_mq.md#Q24)

[Module 4] [来源:小红书][互联网公司|拼多多|二面][2025-12] 说一下Kafka的Rebalance机制，Consumer Group中新增或减少消费者时分区如何重新分配？ → 详见 [解答](answers/module_04_cache_mq.md#Q25)

[Module 4] [来源:小红书][互联网公司|京东|综合][2026-05] 为什么京东内部大量使用 RocketMQ？它相比 Kafka 的优势在哪些地方？ → 详见 [解答](answers/module_04_cache_mq.md#Q26)

[Module 4] [来源:牛客][互联网公司|字节跳动/美团|一面][2025-12/2026-01] RocketMQ和Kafka的区别是什么？为什么选RocketMQ而不是Kafka？ → 详见 [解答](answers/module_04_cache_mq.md#Q27)

[Module 4] [来源:CSDN][互联网公司|得物|一面][2026-05] Kafka一般用在什么场景？为什么选它而不是RabbitMQ？ → 详见 [解答](answers/module_04_cache_mq.md#Q28)

[Module 4] [来源:CSDN][其他|未知|综合][2025-12] RocketMQ的NameServer作用是什么？与Kafka的ZooKeeper有什么区别？ → 详见 [解答](answers/module_04_cache_mq.md#Q29)

[Module 4] [来源:小红书/牛客][互联网公司|京东/字节跳动/阿里巴巴|综合/一面][2026-05/2025-12/2025-11] 如何保证消息在传输过程中不丢失？请从生产、代理和消费三个环节说明。 → 详见 [解答](answers/module_04_cache_mq.md#Q30)

[Module 4] [来源:小红书][互联网公司|腾讯|一面][2026-04] 如何保证消息百分之百入库？描述消息从生产到消费的完整可靠链路。 → 详见 [解答](answers/module_04_cache_mq.md#Q31)

[Module 4] [来源:小红书/牛客][互联网公司|字节跳动/京东|一面/综合][2026-04/2026-05] 消息队列如何解决重复消费问题？如何保证消息幂等？ → 详见 [解答](answers/module_04_cache_mq.md#Q32)

[Module 4] [来源:CSDN][其他|未知|综合][2025-12] 消息队列如何保证消息不被重复消费？如何保证消息消费的顺序性？如何解决消息堆积？ → 详见 [解答](answers/module_04_cache_mq.md#Q33)

[Module 4] [来源:小红书][互联网公司|京东|综合][2026-05] 谈谈事务消息的实现逻辑，如何保证本地事务与消息发送的原子性？ → 详见 [解答](answers/module_04_cache_mq.md#Q34)

[Module 4] [来源:小红书][互联网公司|京东|综合][2026-05] 顺序消息是如何实现的？在全局顺序和局部顺序之间如何取舍？ → 详见 [解答](answers/module_04_cache_mq.md#Q35)

[Module 4] [来源:小红书][互联网公司|字节跳动|一面][2026-04] 消息队列的好处是什么？ → 详见 [解答](answers/module_04_cache_mq.md#Q36)

[Module 4] [来源:小红书][互联网公司|京东|综合][2026-05] 消息队列如何处理消息积压问题？如果下游消费过慢怎么优化？ → 详见 [解答](answers/module_04_cache_mq.md#Q37)

[Module 4] [来源:牛客][互联网公司|阿里巴巴|一面][2025-11] 怎么使用RabbitMQ延迟队列实现订单超时自动取消？ → 详见 [解答](answers/module_04_cache_mq.md#Q38)

[Module 4] [来源:牛客][互联网公司|字节跳动|一面][2025-12] 消息队列的推拉模式有什么区别？ → 详见 [解答](answers/module_04_cache_mq.md#Q39)

[Module 4] [来源:小红书][互联网公司|腾讯|一面][2026-04] 死信队列里面是怎么处理的？ → 详见 [解答](answers/module_04_cache_mq.md#Q40)

[Module 4] [来源:小红书/牛客][互联网公司|京东/熙牛|综合/二面][2026-05/2026-04] 解释分布式锁的几种实现方式。Redisson看门狗机制是什么？分布式锁误删如何发生？如何避免？ → 详见 [解答](answers/module_04_cache_mq.md#Q41)

[Module 4] [来源:小红书][互联网公司|京东|综合][2026-05] 在分布式系统中，你是如何通过 MQ 实现服务异步解耦的？ → 详见 [解答](answers/module_04_cache_mq.md#Q42)

[Module 4] [来源:阿里云开发者社区][其他|未知|综合][2025-Q4] 项目是怎么保证缓存一致性的？双写不一致的解决方案？ → 详见 [解答](answers/module_04_cache_mq.md#Q43)

[Module 4] [来源:CSDN][互联网公司|某大厂|二面][2026-04] 热点帖子详情页秒开，你会怎么用Redis？缓存穿透/击穿/雪崩怎么治理？ → 详见 [解答](answers/module_04_cache_mq.md#Q44)

---

## 🎯 Module 5：框架与中间件

[Module 5] [来源:小红书][互联网公司|字节跳动|一面][2026-04] 平时有用Spring框架？IOC和AOP是什么？ → 详见 [解答](answers/module_05_framework.md#Q1)

[Module 5] [来源:CSDN][互联网公司|某大厂|一面][2026-04] Spring Boot项目里为什么一般不用new创建服务对象，而是交给容器？ → 详见 [解答](answers/module_05_framework.md#Q2)

[Module 5] [来源:牛客][互联网公司|字节跳动|一面][2026-04] Controller/Service/Repository三层架构的功能是什么？各层之间如何交互？ → 详见 [解答](answers/module_05_framework.md#Q3)

[Module 5] [来源:阿里云开发者社区][其他|未知|综合][2025-Q4] Spring Boot和Spring Cloud的理解和区别？Spring Cloud Alibaba与Spring Cloud有什么区别？ → 详见 [解答](answers/module_05_framework.md#Q4)

[Module 5] [来源:阿里云开发者社区][其他|未知|综合][2025-Q4] 服务注册与发现的流程是怎样的？OpenFeign的工作原理？ → 详见 [解答](answers/module_05_framework.md#Q5)

[Module 5] [来源:CSDN][互联网公司|某大厂|二面][2026-04] 微服务调用用OpenFeign，如何做超时、重试、熔断与降级？ → 详见 [解答](answers/module_05_framework.md#Q6)

[Module 5] [来源:阿里云开发者社区][其他|未知|综合][2025-Q4] 网关鉴权怎么实现的？如何保证消息的可靠性？如何保证MQ幂等性？ → 详见 [解答](answers/module_05_framework.md#Q7)

[Module 5] [来源:CSDN][互联网公司|某大厂|一面][2026-04] 数据库连接池你选HikariCP的理由？常见参数怎么定？ → 详见 [解答](answers/module_05_framework.md#Q8)

[Module 5] [来源:小红书][互联网公司|拼多多|一面][2025-12] 一个Spring Boot应用启动缓慢，如何定位具体耗时的@Configuration或@Bean初始化步骤？ → 详见 [解答](answers/module_05_framework.md#Q9)

[Module 5] [来源:牛客][互联网公司|阿里巴巴|一面][2025-11] RPC协议包括哪些内容？为什么有了HTTP还要有RPC？ → 详见 [解答](answers/module_05_framework.md#Q10)

---

## 🎯 Module 6：系统设计

[Module 6] [来源:小红书/牛客/CSDN][互联网公司|阿里巴巴|一面][2026-04/2025-11] CAP理论的理解？一般分布式业务系统使用哪两个原则？ → 详见 [解答](answers/module_06_system_design.md#Q1)

[Module 6] [来源:CSDN][其他|未知|综合][2026-05] CAP理论与BASE理论的核心要点？ → 详见 [解答](answers/module_06_system_design.md#Q2)

[Module 6] [来源:小红书/CSDN][其他|未知|综合][2026-02/2025-12/2026-05] 分布式事务中2PC/3PC、TCC、SAGA、消息最终一致性的区别和适用场景？ → 详见 [解答](answers/module_06_system_design.md#Q3)

[Module 6] [来源:小红书][互联网公司|拼多多|二面][2025-12] 谈一谈你对最终一致性的理解。TCC、Saga、本地消息表、事务消息的优缺点对比？ → 详见 [解答](answers/module_06_system_design.md#Q4)

[Module 6] [来源:小红书/CSDN][互联网公司|拼多多/其他|二面/综合][2025-12/2026-05] 设计一个分布式全局唯一ID生成器，你会考虑哪些核心要素？雪花算法 vs 号段模式各有什么优劣？ → 详见 [解答](answers/module_06_system_design.md#Q5)

[Module 6] [来源:小红书][互联网公司|拼多多|二面][2025-12] 如何解决时钟回拨问题？ → 详见 [解答](answers/module_06_system_design.md#Q6)

[Module 6] [来源:小红书][其他|未知|综合][2026-04] 分布式幂等性如何设计？ → 详见 [解答](answers/module_06_system_design.md#Q7)

[Module 6] [来源:CSDN][其他|未知|综合][2026-05] 接口幂等性如何保证？CQRS命令查询职责分离的适用场景？ → 详见 [解答](answers/module_06_system_design.md#Q8)

[Module 6] [来源:小红书][其他|未知|综合][2026-04] 常见的负载均衡算法有哪些？如何进行服务划分？ → 详见 [解答](answers/module_06_system_design.md#Q9)

[Module 6] [来源:小红书/多平台][其他|未知|综合][2026-04/2026-05] 常用的限流算法有哪些？滑动窗口、令牌桶、漏桶的区别和原理？ → 详见 [解答](answers/module_06_system_design.md#Q10)

[Module 6] [来源:牛客][互联网公司|美团|一面][2026-01] 自研限流器：令牌桶参数有没有考虑预热？限流和熔断的区别？ → 详见 [解答](answers/module_06_system_design.md#Q11)

[Module 6] [来源:小红书][其他|未知|综合][2026-04] 熔断和降级的区别是什么？ → 详见 [解答](answers/module_06_system_design.md#Q12)

[Module 6] [来源:阿里云开发者社区][其他|未知|综合][2025-Q4] 什么是分布式服务雪崩？熔断降级核心解决什么问题？ → 详见 [解答](answers/module_06_system_design.md#Q13)

[Module 6] [来源:阿里云开发者社区][其他|未知|综合][2025-Q4] 请详细讲解熔断器的核心状态机，包括完整的状态流转规则。半开状态的核心作用是什么？ → 详见 [解答](answers/module_06_system_design.md#Q14)

[Module 6] [来源:阿里云开发者社区][其他|未知|综合][2025-Q4] 主流的熔断策略有哪些？各自的核心逻辑和适用场景？ → 详见 [解答](answers/module_06_system_design.md#Q15)

[Module 6] [来源:阿里云开发者社区][其他|未知|综合][2025-Q4] 生产环境中熔断阈值的核心配置最佳实践是什么？如何设计一套微服务全链路的熔断降级体系？ → 详见 [解答](answers/module_06_system_design.md#Q16)

[Module 6] [来源:阿里云开发者社区][其他|未知|综合][2025-Q4] Resilience4j和Sentinel的核心定位与区别是什么？ → 详见 [解答](answers/module_06_system_design.md#Q17)

[Module 6] [来源:阿里云开发者社区][其他|未知|综合][2025-Q4] Sentinel实现熔断、限流的底层原理？Seata是怎么进行分布式事务控制的？ → 详见 [解答](answers/module_06_system_design.md#Q18)

[Module 6] [来源:小红书/B站/多平台/百度开发者][互联网公司|拼多多/阿里巴巴|二面/综合][2025-12/2026-05] 高并发秒杀系统如何设计？如何解决超卖？库存扣减是先扣Redis再同步数据库吗？ → 详见 [解答](answers/module_06_system_design.md#Q19)

[Module 6] [来源:牛客][互联网公司|阿里巴巴|二面][2025-11] 秒杀设计考虑的最主要几个问题是什么？怎么保证库存不出错？ → 详见 [解答](answers/module_06_system_design.md#Q20)

[Module 6] [来源:小红书][其他|未知|综合][2026-02] 如何避免用户重复下单？ → 详见 [解答](answers/module_06_system_design.md#Q21)

[Module 6] [来源:B站/百度开发者][其他|未知|综合][2026-05/2025-12] 30分钟未支付自动取消，用户在29分59秒付钱，30分钟超时自动取消也触发——代码怎么写？百万级订单超时自动取消系统如何设计？ → 详见 [解答](answers/module_06_system_design.md#Q22)

[Module 6] [来源:B站][互联网公司|百度|二面][2026-05] 请设计一个SSO系统，支持10个微服务，日活100万 → 详见 [解答](answers/module_06_system_design.md#Q23)

[Module 6] [来源:牛客][其他|熙牛|二面][2026-04] 单点登录流程是怎样的？权限体系涉及哪些实体和表？ → 详见 [解答](answers/module_06_system_design.md#Q24)

[Module 6] [来源:牛客][互联网公司|字节跳动|一面][2026-04] 鉴权如何实现？ → 详见 [解答](answers/module_06_system_design.md#Q25)

[Module 6] [来源:B站][其他|未知|综合][2026-05] 如何设计一个实时、可靠、可扩展的登录拉黑与强制下线系统？ → 详见 [解答](answers/module_06_system_design.md#Q26)

[Module 6] [来源:B站][其他|未知|综合][2026-05] 黑名单网址过滤系统如何设计？ → 详见 [解答](answers/module_06_system_design.md#Q27)

[Module 6] [来源:B站][其他|未知|综合][2026-05] 从零设计分布式链路跟踪系统 → 详见 [解答](answers/module_06_system_design.md#Q28)

[Module 6] [来源:CSDN][互联网公司|某大厂|二面][2026-04] 链路追踪你怎么做？Jaeger/Zipkin/Micrometer/Prometheus各干什么？ → 详见 [解答](answers/module_06_system_design.md#Q29)

[Module 6] [来源:多平台][其他|未知|综合][2026-Q1] 如何用Micrometer+Prometheus+Grafana做监控？如何用Jaeger/Zipkin做分布式链路追踪？ → 详见 [解答](answers/module_06_system_design.md#Q30)

[Module 6] [来源:小红书][互联网公司|拼多多|三面][2025-12] 谈谈你对系统"可观测性"的理解。Metrics、Logging、Tracing三者关系是什么？ → 详见 [解答](answers/module_06_system_design.md#Q31)

[Module 6] [来源:牛客][互联网公司|腾讯|一面][2025-12] 支付流程的架构设计是怎样的？唯一ID用什么方法生成？ → 详见 [解答](answers/module_06_system_design.md#Q32)

[Module 6] [来源:CSDN][金融科技|某支付公司|二面/三面][2025-12] 支付成功消息如何保证可靠送达？支付业务一致性怎么实现？支付安全接口怎么做鉴权认证？ → 详见 [解答](answers/module_06_system_design.md#Q33)

[Module 6] [来源:小红书][互联网公司|字节跳动|二面][2026-05] 公司员工刷卡坐电梯，如何调度电梯集群？需要设计数据库和调度算法 → 详见 [解答](answers/module_06_system_design.md#Q34)

[Module 6] [来源:CSDN][其他|未知|综合][2025-12] 如何解决微服务调用中的服务雪崩问题？ → 详见 [解答](answers/module_06_system_design.md#Q35)

---

## 🎯 Module 7：微服务与云原生

[Module 7] [来源:CSDN][其他|未知|综合][2025-12] 微服务间的同步通信和异步通信有什么区别？各自适用什么场景？ → 详见 [解答](answers/module_07_microservice.md#Q1)

[Module 7] [来源:CSDN][其他|未知|综合][2025-12] 服务注册与发现是怎么实现的？你用过哪些注册中心？ → 详见 [解答](answers/module_07_microservice.md#Q2)

[Module 7] [来源:小红书][互联网公司|拼多多|三面][2025-12] 如何看待微服务架构的"过度拆分"问题？划分服务边界有什么原则或方法论？ → 详见 [解答](answers/module_07_microservice.md#Q3)

[Module 7] [来源:CSDN][其他|未知|综合][2025-12] 什么是微服务？和单体架构的核心区别是什么？微服务的核心优势和劣势？ → 详见 [解答](answers/module_07_microservice.md#Q4)

---

## 🎯 Module 8：计算机基础

[Module 8] [来源:小红书][其他|未知|综合][2026-02] CPU 飙高如何排查？ → 详见 [解答](answers/module_08_cs_fundamentals.md#Q1)

[Module 8] [来源:小红书/牛客][互联网公司|腾讯/美团|一面][2026-04/2026-01] 进程和线程在操作系统层面的核心区别是什么？线程哪些资源可共享、哪些不可共享？ → 详见 [解答](answers/module_08_cs_fundamentals.md#Q2)

[Module 8] [来源:牛客][互联网公司|腾讯|一面][2025-11] 进程切换发生了什么？为什么消耗大？上下文主要包括哪些内容？ → 详见 [解答](answers/module_08_cs_fundamentals.md#Q3)

[Module 8] [来源:牛客][互联网公司|腾讯|一面][2025-11] CPU使用率很低但top负载很高，一般发生了什么问题？ → 详见 [解答](answers/module_08_cs_fundamentals.md#Q4)

[Module 8] [来源:小红书][互联网公司|京东|综合][2026-05] 解释一下虚拟内存与物理内存的映射机制，以及什么是页缺失 (Page Fault)。 → 详见 [解答](answers/module_08_cs_fundamentals.md#Q5)

[Module 8] [来源:牛客][互联网公司|快手|一面][2026-05] 为什么要用虚拟内存？ → 详见 [解答](answers/module_08_cs_fundamentals.md#Q6)

[Module 8] [来源:小红书/牛客][互联网公司|字节跳动/百度|一面][2026-04/2026-05] TCP三次握手是哪三次？为什么是3次？2次行不行？4次行不行？ → 详见 [解答](answers/module_08_cs_fundamentals.md#Q7)

[Module 8] [来源:小红书/牛客][互联网公司|京东/字节跳动|综合/一面][2026-05/2025-12] TCP的四次挥手流程是怎样的？为什么挥手需要四次？ → 详见 [解答](answers/module_08_cs_fundamentals.md#Q8)

[Module 8] [来源:牛客][互联网公司|腾讯|一面][2026-04] TCP和UDP区别及适用场景是什么？ → 详见 [解答](answers/module_08_cs_fundamentals.md#Q9)

[Module 8] [来源:牛客][互联网公司|阿里巴巴|二面][2025-11] TCP拥塞控制和流量控制的区别是什么？ → 详见 [解答](answers/module_08_cs_fundamentals.md#Q10)

[Module 8] [来源:牛客][互联网公司|阿里巴巴|二面][2025-11] 微信使用TCP还是UDP？为什么会出现双方聊天顺序不一致？ → 详见 [解答](answers/module_08_cs_fundamentals.md#Q11)

[Module 8] [来源:小红书][互联网公司|字节跳动|二面][2026-05] select poll epoll 区别是什么？epoll 的时间复杂度是多少？ → 详见 [解答](answers/module_08_cs_fundamentals.md#Q12)

[Module 8] [来源:小红书][互联网公司|字节跳动|二面][2026-05] 为什么 epoll 选择 LT 而不是 ET？ → 详见 [解答](answers/module_08_cs_fundamentals.md#Q13)

[Module 8] [来源:小红书][互联网公司|字节跳动|二面][2026-05] eventpoll 的 3 个核心成员是什么？epoll 的等待队列底层原理是什么？ → 详见 [解答](answers/module_08_cs_fundamentals.md#Q14)

[Module 8] [来源:小红书][互联网公司|字节跳动|二面][2026-05] epoll_create / epoll_wait 的底层原理是什么？ → 详见 [解答](answers/module_08_cs_fundamentals.md#Q15)

[Module 8] [来源:小红书][互联网公司|字节跳动|二面][2026-05] epoll 有哪些缺点？惊群效应是什么？select poll epoll 都有惊群效应吗？ → 详见 [解答](answers/module_08_cs_fundamentals.md#Q16)

[Module 8] [来源:小红书][互联网公司|字节跳动|二面][2026-05] epoll mmap是什么？epoll 是零拷贝吗？ → 详见 [解答](answers/module_08_cs_fundamentals.md#Q17)

[Module 8] [来源:小红书/牛客][互联网公司|拼多多/腾讯/字节跳动|二面/一面][2025-12/2025-11/2025-12] 如何理解"零拷贝"(Zero-Copy)技术？在Netty中ByteBuf如何利用零拷贝来提升性能？ → 详见 [解答](answers/module_08_cs_fundamentals.md#Q18)

[Module 8] [来源:小红书/牛客][互联网公司|百度/字节跳动|一面][2026-05/2026-04] 死锁的四个条件是什么？解决方式有哪些？ → 详见 [解答](answers/module_08_cs_fundamentals.md#Q19)

[Module 8] [来源:牛客][互联网公司|Shopee|一面][2025-11] TCP连接是逻辑还是物理概念？同一物理链路上多个TCP连接怎么区分？ → 详见 [解答](answers/module_08_cs_fundamentals.md#Q20)

[Module 8] [来源:小红书][其他|未知|综合][2026-02] 1亿个数据取出最大前100个，如何实现？ → 详见 [解答](answers/module_08_cs_fundamentals.md#Q21)

[Module 8] [来源:小红书][其他|未知|综合][2026-02] 1G 的内存，40 亿个 QQ 号，如何实现去重？ → 详见 [解答](answers/module_08_cs_fundamentals.md#Q22)

[Module 8] [来源:小红书][其他|未知|综合][2026-02] 4G 的内存，500G 数据需要排序，如何实现？ → 详见 [解答](answers/module_08_cs_fundamentals.md#Q23)

---

## 📦 其他 / 综合类

[来源:小红书][其他|未知|综合][2026-02] 接口响应慢如何排查？ → 详见 [解答](answers/module_00_other.md#Q1)

[来源:小红书][其他|未知|综合][2026-04] 线上接口大量超时，完整排查流程是怎样的？ → 详见 [解答](answers/module_00_other.md#Q2)

[来源:小红书][互联网公司|拼多多|二面][2025-12] 线上接口TP99突然从50ms飙升到500ms，但TP50和TP90变化不大，如何排查？ → 详见 [解答](answers/module_00_other.md#Q3)

[来源:小红书/CSDN][互联网公司|百度|综合/一面][2026-05] 数组和slice分别是值类型还是引用类型？两个slice可以用==进行比较吗？Slice底层结构、扩容机制？ → 详见 [解答](answers/module_00_other.md#Q4)

[来源:CSDN][其他|未知|综合][2025-12] Map底层结构、哈希冲突、扩容机制？ → 详见 [解答](answers/module_00_other.md#Q5)

[来源:小红书/CSDN][互联网公司|百度|综合/一面][2026-05/2026-03] Channel是什么？select多路复用是什么？有缓冲和无缓冲区别？close后的行为？ → 详见 [解答](answers/module_00_other.md#Q6)

[来源:小红书/InfoQ/CSDN][互联网公司|百度|综合][2026-05/2026-03] GMP调度模型如何理解？G/M/P各自职责？本地队列挂在P还是M上？ → 详见 [解答](answers/module_00_other.md#Q7)

[来源:CSDN][互联网公司|百度|综合][2026-03] Go的内存逃逸问题怎么分析？协程能不能无限创建？ → 详见 [解答](answers/module_00_other.md#Q8)

[来源:小红书][互联网公司|百度|一面][2026-05] defer是什么？多个defer执行顺序是怎样的？即使panic，defer也会执行吗？ → 详见 [解答](answers/module_00_other.md#Q9)

[来源:小红书][互联网公司|百度|一面][2026-05] Golang map 并发安全吗？sync.RWMutex + map 和 sync.Map 哪种更高效？ → 详见 [解答](answers/module_00_other.md#Q10)

[来源:小红书/CSDN][互联网公司|百度|综合][2026-05/2026-03] mutex的理解？普通模式和饥饿模式的区别？ → 详见 [解答](answers/module_00_other.md#Q11)

[来源:小红书][互联网公司|百度|综合][2026-05] Go 逃逸分析、GC机制（三色标记法）、sync.Pool的使用场景？ → 详见 [解答](answers/module_00_other.md#Q12)

[来源:CSDN][其他|未知|综合][2025-12] Goroutine泄露场景有哪些？ → 详见 [解答](answers/module_00_other.md#Q13)

[来源:CSDN][互联网公司|百度|综合][2026-03] 协程池怎么理解？ → 详见 [解答](answers/module_00_other.md#Q14)

[来源:小红书][其他|未知|综合][2026-02] 系统每天晚上都会有一段时间瘫痪（高峰期），需要重启，你觉得是什么原因导致的？ → 详见 [解答](answers/module_00_other.md#Q15)

[来源:小红书][互联网公司|腾讯|一面][2026-04] RAG（检索增强生成）的工作流分哪几步？知识库生成的步骤是什么？ → 详见 [解答](answers/module_00_other.md#Q16)

[来源:小红书/CSDN][互联网公司|腾讯/某大厂|一面/三面][2026-04] 向量检索时怎么判断相似度？向量数据库怎么选？ → 详见 [解答](answers/module_00_other.md#Q17)

[来源:小红书][互联网公司|腾讯|一面][2026-04] 你项目里的 Agent 架构是怎么设计的？ → 详见 [解答](answers/module_00_other.md#Q18)

[来源:CSDN][互联网公司|蚂蚁集团|二面][2026-05] Spring AI对于Agent开发提供的常见模式有了解吗？MCP有哪些通讯协议？SSE的断点续传怎么实现？ → 详见 [解答](answers/module_00_other.md#Q19)

[来源:CSDN][互联网公司|某大厂|三面][2026-04] Agent要调用订单/物流/规则服务，如何设计工具执行框架？怎么降低AI幻觉？ → 详见 [解答](answers/module_00_other.md#Q20)

[来源:CSDN][互联网公司|某大厂|三面][2026-04] 聊天会话内存：如何在多轮对话中既记住上下文又不爆token？ → 详见 [解答](answers/module_00_other.md#Q21)

[来源:CSDN][互联网公司|某大厂|三面][2026-05] 灰度与回滚：AIGC答案质量不好怎么快速止血？怎么灰度？怎么一键回滚？ → 详见 [解答](answers/module_00_other.md#Q22)

[来源:多平台][其他|未知|综合][2026-Q1] RAG架构中向量库选Milvus/Chroma/Redis的考虑点是什么？幻觉怎么缓解？ → 详见 [解答](answers/module_00_other.md#Q23)

[来源:CSDN][其他|未知|综合][2025-12] 什么是微服务？和单体架构的核心区别是什么？微服务的核心优势和劣势？ → 详见 [解答](answers/module_00_other.md#Q24)

---

## ⭐ 近期高频题（近1个月出现 3 次以上）

| 出现次数 | 题目概要 | 涉及模块 |
|:---:|:---|:---|
| 5 | 高并发秒杀系统如何设计？如何解决超卖？库存扣减方案 | Module 6 |
| 5 | MySQL和Redis的数据一致性怎么保证？ | Module 4 |
| 4 | 布隆过滤器的原理和应用 | Module 4 |
| 4 | 缓存穿透、击穿和雪崩的解决方案 | Module 4 |
| 4 | 消息队列如何解决重复消费/幂等性问题 | Module 4 |
| 4 | 分布式ID生成方案对比（雪花算法 vs 号段模式） | Module 6 |
| 3 | TCP三次握手为什么是3次 | Module 8 |
| 3 | CAP理论的理解 | Module 6 |
| 3 | 分布式事务方案对比（2PC/TCC/SAGA） | Module 6 |
| 3 | MVCC原理及实现 | Module 3 |

---
