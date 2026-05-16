# 并发编程 - 面试题解答

> 生成日期：2026-05-16 | 共 16 题

---

## Q1：volatile关键字如何保证内存可见性和禁止指令重排？它的底层是如何实现的？

### 考察点
考察候选人对 Java 内存模型（JMM）、CPU 缓存一致性协议和内存屏障机制的底层理解，而非停留在"volatile 保证可见性"的表面。

### 解答思路
1. 从 CPU 多核缓存架构引出可见性问题，说明 `volatile` 如何通过总线锁定/缓存一致性协议解决。
2. 从编译器优化和 CPU 乱序执行引出指令重排问题，说明 `volatile` 如何通过内存屏障禁止重排。
3. 结合 HotSpot 源码或 JIT 编译产物，说明 `lock` 前缀指令的实际作用。

### 参考答案
在 JMM 中，每个线程有自己的工作内存（CPU 缓存），主内存是所有线程共享的。普通变量的修改可能只刷到线程的工作内存，其他线程不可见，这就是"可见性问题"。

`volatile` 从两个维度解决问题：

第一，**内存可见性**。被 `volatile` 修饰的变量在写入后，会立即强制刷回主内存；读取时，会强制从主内存重新加载，而不是使用工作内存的缓存值。这个语义通过 CPU 的 **MESI 缓存一致性协议** 或 **总线锁定** 实现 —— `volatile` 写操作在 x86 上被 JIT 编译为带 `lock` 前缀的指令，`lock` 前缀会锁住总线或通过 MESI 协议发出一条 RFO（Request For Ownership）消息，使其他 CPU 核心中该变量的缓存行（Cache Line）失效。下次其他核心读取时，必须从主内存或持有最新值的缓存中重新获取。

第二，**禁止指令重排序**。JVM 在 `volatile` 读写前后插入内存屏障（Memory Barrier）：
- `volatile` 写之前插入 **StoreStore** 屏障，禁止前面的普通写和后面的 `volatile` 写重排。
- `volatile` 写之后插入 **StoreLoad** 屏障，禁止后面的读写与前面的 `volatile` 写重排（这是开销最大的屏障）。
- `volatile` 读之后插入 **LoadLoad** 和 **LoadStore** 屏障。

在 x86 架构下，由于 TSO（Total Store Order）内存模型已经保证了写-写和读-读的顺序，JVM 实际只需在写后插入 `StoreLoad` 屏障（即 `lock addl $0x0, (%rsp)`，通过把一个无意义的加法锁在栈指针上刷 store buffer），读操作在 x86 上本身就有 Load 屏障的语义，因此 `volatile` 读在 x86 上几乎零开销。这也是为什么 DCL（Double-Checked Locking）单例中的 `instance` 必须声明为 `volatile`—— 没有 `StoreLoad` 屏障，另一个线程可能拿到一个构造未完成的对象引用。

**加分项：** 能对比 C++ 的 `std::atomic` 的 memory_order 与 Java `volatile` 的对应关系（Java 的 `volatile` 等价于 C++ `memory_order_seq_cst`），以及 `Unsafe.putOrderedObject` 的 lazySet 语义（只保证写-写顺序，不保证对其他线程立即可见，适合记录日志等场景）。

---

## Q2：CAS和普通加锁的优劣是什么？互斥锁与自旋锁的区别是什么？

### 考察点
考察无锁编程（Lock-Free）和悲观锁两种并发策略的区别，以及对 CPU 层面锁实现方式的底层认知。

### 解答思路
1. 先对比 CAS 无锁（乐观并发）和普通加锁（悲观并发）在原理、适用场景、性能上的差异。
2. 再对比互斥锁（mutex）和自旋锁（spin lock）在实现机制和 CPU 使用上的区别。
3. 给出实际生产的选型经验。

### 参考答案

**CAS vs 普通加锁：**

| 维度 | CAS（乐观锁） | 普通加锁（悲观锁） |
|---|---|---|
| 原理 | 先操作，失败后重试（自旋） | 先获取锁，获取不到阻塞等待 |
| 线程状态 | 不阻塞，CPU 空转 | 阻塞，让出 CPU（系统调度） |
| 上下文切换 | 无（但可能自旋消耗 CPU） | 有（内核态切换，数微秒开销） |
| 适用场景 | 竞争小、临界区短 | 竞争大、临界区长 |
| ABA 风险 | 有（需用版本号解决） | 无 |
| 死锁风险 | 无经典死锁，但可能活锁 | 有死锁风险 |
| 典型实现 | `AtomicInteger`、`ConcurrentLinkedQueue` | `synchronized`、`ReentrantLock` |

生产经验：CAS 并不是银弹。在竞争激烈（高并发写同一个变量）时，CAS 的重试次数急剧上升，CPU 空转严重，可能比加锁更慢。`LongAdder` 就是为了解决这个问题设计的 —— 它通过将单一热点值拆分到多个 Cell 中，使并发的 CAS 操作分散到不同的 Cell，写完后求和，比 `AtomicLong` 在高并发下吞吐量高很多。

**互斥锁 vs 自旋锁：**

| 维度 | 互斥锁（Mutex） | 自旋锁（Spin Lock） |
|---|---|---|
| 等待方式 | 阻塞，让出 CPU，OS 将线程放入等待队列 | CPU 忙等（busy-wait），循环检查 |
| CPU 消耗 | 低（等待时不消耗 CPU） | 高（持续占用 CPU 核心） |
| 响应延迟 | 高（涉及线程调度，约 10-30 微秒） | 低（锁释放后立刻获取，纳秒级） |
| 适用场景 | 临界区执行时间长（> 上下文切换开销） | 临界区极短（< 上下文切换开销） |
| 是否需要内核态 | 需要（调用操作系统调度） | 不需要（纯用户态操作） |

`synchronized` 的锁升级过程充分体现了这两者的结合 —— 偏向锁和轻量级锁阶段采用自旋策略，重量级锁阶段转为互斥量，这也是"自适应自旋"的思路。

**加分项：** 提及 `LongAdder` 的分段累加思想（Striped64）是解决 CAS 热点竞争问题的经典手段；提及 `synchronized` 在 JDK 15 之后默认关闭偏向锁（`-XX:+UseBiasedLocking` 已 Deprecated）的原因是偏向锁在高并发场景下撤销开销大，实际收益有限。

---

## Q3：解释一下 CAS 原理及 ABA 问题，你在实际项目中有没有用到过原子类？

### 考察点
考察对 CAS 底层 CPU 指令的支持、ABA 问题的根因及解决方案，以及原子类在生产中的实际应用经验。

### 解答思路
1. 从 CPU 指令层面解释 CAS 的实现（`cmpxchg` + `lock` 前缀）。
2. 用一个具体例子解释 ABA 问题，并结合 `AtomicStampedReference` 给出解决方案。
3. 分享实际生产中使用原子类的场景和避坑经验。

### 参考答案

CAS（Compare-And-Swap）是一条 CPU 原子指令（x86 上是 `cmpxchg`，ARM 上是 `LDREX/STREX`），它接受三个操作数：内存位置 V、期望值 A、新值 B。当且仅当 V 的当前值等于 A 时，才将 V 更新为 B；否则不做任何操作。无论成功与否，都返回 V 的当前值。这个"比较-交换"过程在硬件层面是原子的，中间不会被中断。

**ABA 问题**的经典场景：线程 T1 读取变量值为 A，被切换走；T2 将 A 改为 B；T3 将 B 改回 A；T1 恢复后 CAS 操作发现值仍是 A，认为没有变化而成功更新。但 T1 不知道中间值已经经历了 A->B->A 的变化。在引用类型场景下这尤其危险 —— 比如一个无锁栈的 top 指针从 Node1(A) 变成 Node2 又变回 Node1(A)，但 Node1 的 next 指针可能已经变了，T1 CAS 成功后栈结构会被破坏。

解决方案是引入**版本号**：
- `AtomicStampedReference`：维护一个 int 类型的 stamp，每次更新 stamp+1，CAS 时同时比较值和 stamp。
- `AtomicMarkableReference`：维护一个 boolean 标记，适合简单的"是否被修改过"的场景。

**实际项目经验：**

1. **计数器场景**：社区帖子的点赞数、阅读数，用 `AtomicInteger`/`LongAdder` 在内存中做计数，定期批量刷到数据库。`LongAdder` 在 QPS 过万时比 `AtomicLong` 吞吐量高一倍以上。
2. **状态机控制**：支付状态流转 `待支付 -> 支付中 -> 已支付` 用 `AtomicInteger.compareAndSet` 保证状态单次转换，避免重复回调。
3. **无锁数据结构**：消息队列的 ring buffer 用 `AtomicLong` 做游标控制（类似 Disruptor 模式）。

**避坑经验：** 千万不要在循环中 CAS 失败后做耗时操作（如 RPC 调用），否则线程池会被耗死。CAS 的 retry loop 应该只包含 CAS 操作本身，任何副作用都放在循环外面。

**加分项：** 提及 JDK 9 的 `VarHandle` 提供了比 `AtomicXXX` 更灵活的内存排序控制（relaxed/acquire/release/volatile 四种模式），可以实现比 `volatile` 成本更低的操作；提及 Disruptor 中 Sequence 的 `lazySet`（等价于 `putOrderedLong`）用于批量更新多个消费者的 cursor，减少不必要的内存屏障。

---

## Q4：synchronized锁升级的过程是怎样的？为什么会有这个过程？

### 考察点
考察对 JVM 锁优化演进历史的掌握，对偏向锁、轻量级锁、重量级锁三个阶段的深入理解，以及对"为什么需要锁升级"这个设计问题的思考。

### 解答思路
1. 先回答"为什么需要锁升级"：说明工程中的锁竞争往往符合"大多数时候只有一个线程访问"的经验规律。
2. 按阶段描述偏向锁 -> 轻量级锁 -> 重量级锁的升级过程和技术实现（Mark Word 变化）。
3. 结合 JDK 版本演进说明偏向锁的现状。

### 参考答案

**为什么需要锁升级？** 基于一个工程发现：HotSpot 团队通过分析大量 Java 应用发现，大部分锁在整个生命周期中不会被竞争，或者只被同一个线程反复获取。如果每个 `synchronized` 都直接走操作系统的 mutex（涉及内核态切换），代价太高。锁升级就是一种"懒加载"优化 —— 先用轻量级手段，当竞争真正出现时再升级到重量级。

**升级过程的三个阶段：**

**阶段一：偏向锁（Biased Locking）**
- 触发：第一次有线程获取锁时。
- Mark Word 变化：将线程 ID 写入对象头的 Mark Word 中，标记为偏向锁状态。
- 后续行为：该线程再次进入同步块时，只需比较 Mark Word 中的线程 ID 是否是自己，不需要任何 CAS 操作。
- 撤销时机：当另一个线程尝试获取这个偏向锁时，偏向锁被撤销，升级到轻量级锁。撤销过程需要在全局安全点（SafePoint）进行，会 Stop-The-World，开销较大。
- 现状：JDK 15 默认关闭，JDK 18+ 已被废弃。原因是在高并发服务中锁竞争普遍，偏向锁的撤销开销反而拖累性能。

**阶段二：轻量级锁（Thin Lock / CAS-Based）**
- 触发：锁被不同线程竞争，偏向锁撤销后。
- 实现：每个线程在栈帧中创建一个 Lock Record 空间，拷贝对象头的 Mark Word，然后通过 CAS 尝试将对象头的 Mark Word 替换为指向 Lock Record 的指针。
- 成功：获取轻量级锁，线程通过**自旋**等待。
- 失败（自旋若干次后仍未获取到）：膨胀为重量级锁。

**阶段三：重量级锁（Heavyweight Lock / Monitor）**
- 实现：JVM 向操作系统申请 mutex，对象头的 Mark Word 指向一个 ObjectMonitor 对象。
- 行为：未获取到锁的线程不再自旋，而是进入操作系统的等待队列，被阻塞挂起，由 OS 负责调度唤醒。
- 代价：涉及系统调用、线程上下文切换，大约 10-30 微秒的固定开销。

**Monitor 机制简述：** 每个 Java 对象在 JVM 内部关联一个 `ObjectMonitor`（C++ 对象），包含 `_owner`（持有锁的线程）、`_WaitSet`（调用 `wait()` 的线程集合）、`_EntryList`（等待获取锁的线程队列）。`synchronized` 的本质就是对 ObjectMonitor 的 `enter` 和 `exit` 操作。

**加分项：** 能画出 Mark Word 在不同锁状态下 64-bit 的位布局（无锁：25-bit hash + 1-bit unused + 2-bit age + 1-bit 0 + 2-bit lock state = 01；轻量级锁时指向栈中 Lock Record 的指针 + 00；重量级锁指向 ObjectMonitor 的指针 + 10），并能说明 JVM 为什么要用 2-bit 的 lock state 区分这四种状态。

---

## Q5：ReentrantLock和synchronized的区别？生产上一般用哪个？AQS的实现原理是什么？有哪些实现类？

### 考察点
考察对两种锁机制的全面对比、实际选型判断力，以及 AQS（AbstractQueuedSynchronizer）框架的深度理解。

### 解答思路
1. 从功能、性能、灵活性三个维度对比 ReentrantLock 和 synchronized。
2. 给出生产选型建议（不盲信"ReentrantLock 性能更好"的陈旧认知）。
3. 讲解 AQS 核心原理（CLH 队列变体 + state + 模板方法），列举常见实现类。

### 参考答案

**差异总结表：**

| 维度 | ReentrantLock | synchronized |
|---|---|---|
| 实现层面 | JDK 类（`java.util.concurrent.locks`） | JVM 关键字，C++ 实现 |
| 锁释放 | 必须显式 unlock()，通常放 finally | 自动释放（退出同步块/异常） |
| 可中断 | 支持 `lockInterruptibly()` | 不支持，阻塞期间不可中断 |
| 公平性 | 支持公平/非公平两种模式 | 非公平（JDK 内置） |
| 条件变量 | 支持多个 Condition（`newCondition()`） | 只有一个隐式条件（`wait/notify`） |
| 超时获取 | 支持 `tryLock(timeout, unit)` | 不支持 |
| 性能 | 早期 JDK 版本高，现在与 synchronized 相当 | JDK 6+ 锁优化后性能大幅提升 |
| 死锁排查 | 可以通过 `getQueuedThreads()` 等诊断 | 只能通过 jstack 查看 |

**生产选型建议：** 绝大多数场景优先用 `synchronized`。原因是：(1) JDK 6+ 经过锁升级优化，性能已不输 ReentrantLock；(2) 自动释放，代码更安全，不会忘 unlock；(3) jstack 线程 dump 能直接看到锁持有者。只在以下场景用 ReentrantLock：(a) 需要超时获取锁；(b) 需要可中断的锁获取；(c) 需要公平锁；(d) 需要多个条件变量（如有界阻塞队列的生产者-消费者模型）。

**AQS 实现原理：**

AQS 是整个 `java.util.concurrent` 包的基石，核心是两个东西：

1. **`volatile int state`**：同步状态。不同实现类赋予不同含义（`ReentrantLock` 中用 state=0 表示未锁定，state>0 表示重入次数；`Semaphore` 中用 state 表示剩余许可数；`CountDownLatch` 中用 state 表示待计数数量）。
2. **CLH 队列的变体**：一个 FIFO 的双向链表队列，存储等待获取锁的线程。每个节点（Node）有一个 `waitStatus` 字段表示线程状态（CANCELLED / SIGNAL / CONDITION / PROPAGATE）。获取锁失败时，线程被包装成 Node 加入队尾，然后通过 `LockSupport.park()` 挂起。前驱节点释放锁时，通过 `LockSupport.unpark()` 唤醒后继节点。

**模板方法模式：** AQS 定义了 `tryAcquire`、`tryRelease`、`tryAcquireShared`、`tryReleaseShared`、`isHeldExclusively` 五个 protected 方法，子类只需实现这些方法，AQS 框架自动处理排队、阻塞、唤醒等逻辑。

**常见 AQS 实现类：**
- **独占锁**：`ReentrantLock`（内部 Sync 继承 AQS）、`ReentrantReadWriteLock`
- **共享锁**：`Semaphore`、`CountDownLatch`、`CyclicBarrier`（内部也用 AQS）
- **混合模式**：`ReentrantReadWriteLock`（读锁共享，写锁独占）

**加分项：** 能讲清 AQS 中 `addWaiter` 入队操作为什么要"先快速 CAS 入队再进入完整 enq 逻辑"的两段式设计，以及 `cancelAcquire` 中处理取消节点的复杂性（前驱节点是取消状态时需要向前遍历找到有效节点），体现对源码细节的掌握。

---

## Q6：如何基于AQS实现自定义锁？读写锁的公平性如何保证？锁降级的实现原理？

### 考察点
考察 AQS 模板方法模式的实际运用能力，以及对 `ReentrantReadWriteLock` 内部设计的深度理解。

### 解答思路
1. 以自定义互斥锁为例，展示如何基于 AQS 快速实现一把锁（只需覆写 `tryAcquire` 和 `tryRelease`）。
2. 讲解读写锁公平性的判断逻辑（写者优先 vs 读者优先 vs 公平模式）。
3. 深入读写锁的"锁降级"机制和实际应用场景。

### 参考答案

**基于 AQS 实现自定义锁（以最简单互斥锁为例）：**

```java
public class MyLock {
    private final Sync sync = new Sync();
    
    private static class Sync extends AbstractQueuedSynchronizer {
        @Override
        protected boolean tryAcquire(int arg) {
            if (compareAndSetState(0, 1)) {
                setExclusiveOwnerThread(Thread.currentThread());
                return true;
            }
            return false;
        }
        
        @Override
        protected boolean tryRelease(int arg) {
            setState(0);
            setExclusiveOwnerThread(null);
            return true;
        }
        
        @Override
        protected boolean isHeldExclusively() {
            return getState() == 1;
        }
    }
    
    public void lock()   { sync.acquire(1); }
    public void unlock() { sync.release(1); }
}
```

核心只需要覆写 `tryAcquire` 和 `tryRelease`。当 `tryAcquire` 返回 false 时，AQS 自动将当前线程包装成 Node 加入 CLH 队列尾部并挂起。这里的实现是简易版，完整版还需要支持重入（检查 `getExclusiveOwnerThread() == Thread.currentThread()` 时 state+1）和可中断。

**读写锁的公平性保证：**

`ReentrantReadWriteLock` 的公平性由内部 Sync 实现控制：

- **非公平模式（默认）**：写锁可以插队，读锁在有等待写者时需要排队（避免写者饥饿）。AQS 队列中如果头节点的后继是写者（`shared` 为 false），新来的读线程即使可以获取读锁也必须排队。
- **公平模式**：严格按 CLH 队列的 FIFO 顺序。新请求（无论读或写）先检查队列中是否有等待者，有则入队。

公平 vs 非公平的选择：非公平模式吞吐量更高（减少线程切换），但可能导致写者饥饿。实际生产建议默认使用非公平模式，除非业务有严格的公平性要求。

**锁降级（Lock Downgrading）的实现原理：**

锁降级是指：**先获取写锁 -> 再获取读锁 -> 释放写锁**，最终持有读锁。这是 `ReentrantReadWriteLock` 支持的特性。

典型场景（缓存更新）：

```java
rwLock.writeLock().lock();
try {
    // 1. 更新数据库
    updateDB();
    // 2. 获取读锁（降级开始），保证后续读到的是一致性数据
    rwLock.readLock().lock();
} finally {
    // 3. 释放写锁（降级完成），此时仍持有读锁
    rwLock.writeLock().unlock();
}
try {
    // 4. 仍持有读锁，可以安全读取
    return readCache();
} finally {
    rwLock.readLock().unlock();
}
```

为什么需要锁降级？如果更新完直接释放写锁再获取读锁，中间有一个"无锁窗口期"，其他写者可能修改数据，导致缓存不一致。锁降级保证了**从写锁到读锁的连续性**，中间没有其他写者插入的窗口。

注意 `ReentrantReadWriteLock` **不支持锁升级**（读锁 -> 写锁），因为这会导致死锁：两个读线程都持有读锁同时尝试升级到写锁，互相等待对方释放读锁。

**加分项：** 提及 `StampedLock`（JDK 8+）提供的乐观读模式（`tryOptimisticRead`），在读多写少的场景下比 `ReentrantReadWriteLock` 性能更好，因为它不需要 CAS 操作，只需要校验 stamp 是否被修改过（类似乐观锁的思想，完全无锁读）；提及读写锁的写者饥饿问题和 `StampedLock` 如何通过"读锁转换为写锁"在一定程度上缓解。

---

## Q7：什么是线程池的饱和策略？你会如何配置核心线程数？

### 考察点
考察线程池参数调优的工程经验，以及不同业务场景下的饱和策略选型能力。

### 解答思路
1. 描述线程池的任务处理流程（corePoolSize -> workQueue -> maxPoolSize -> RejectedExecutionHandler），引出饱和策略的位置。
2. 逐一分析四种内置饱和策略的适用场景和风险。
3. 给出核心线程数配置的经验公式和实践建议。

### 参考答案

**线程池任务处理流程与饱和策略：** 当任务提交到 `ThreadPoolExecutor` 时，执行路径为：(1) 如果当前线程数 < `corePoolSize`，新建线程执行；(2) 如果线程数 >= `corePoolSize`，任务进入 workQueue 等待；(3) 如果 workQueue 满了且线程数 < `maxPoolSize`，新建线程执行；(4) 如果 workQueue 满了且线程数 = `maxPoolSize`，触发**饱和策略（RejectedExecutionHandler）**。

**四种内置饱和策略：**

| 策略 | 行为 | 适用场景 | 风险 |
|---|---|---|---|
| `AbortPolicy`（默认） | 抛 `RejectedExecutionException` | 通用，任务不能丢 | 上游不 catch 异常会导致请求失败 |
| `CallerRunsPolicy` | 提交任务的线程自己执行 | 流量削峰，配合 TCP 反压 | 可能阻塞调用方线程，产生连锁故障 |
| `DiscardPolicy` | 静默丢弃 | 日志采集、统计数据（允许少量丢失） | 任务静默丢失，难以发现 |
| `DiscardOldestPolicy` | 丢弃队首（最旧）任务，重新提交 | 旧数据无价值，新数据优先级高的场景 | 丢弃的任务可能是关键任务 |

**生产经验：** 
- `CallerRunsPolicy` 适合 Dubbo、gRPC 等服务调用场景，可以将服务端压力反向传导给调用方，实现自然的背压（Back Pressure）。
- `DiscardOldestPolicy` 适合实时性要求高的场景（如行情推送），丢弃旧数据比返回过期数据更有意义。
- 推荐**自定义饱和策略**：在丢弃/降级的同时记录监控指标（打日志、发告警、埋点），否则线上出了问题很难排查。

**核心线程数配置经验：**

三个维度的判断：

1. **CPU 密集型**：`corePoolSize = CPU 核数 + 1`。多一个线程是考虑到线程可能因 page fault 等原因暂停，CPU 可以调度到备用线程。
2. **IO 密集型**：`corePoolSize = CPU 核数 * 2` 到 `CPU 核数 * (1 + 平均IO等待时间/平均CPU计算时间)`。关键参数是 IO 等待占比，比如数据库查询的 IO 等待是 CPU 计算的 5 倍，则线程数可以设为核心数 * (1+5) = 核心数 * 6。
3. **混合型**：建议拆分为两套线程池，CPU 密集型任务和 IO 密集型任务使用不同的线程池，避免相互影响。

更务实的做法是 **N = N_cpu * U_cpu * (1 + W/C)**（其中 U_cpu 是目标 CPU 利用率、W/C 是等待时间与计算时间之比），然后通过压测验证。实际项目中，我通常先设 `core = CPU核数 * 2`，再根据 JFR（JDK Flight Recorder）的线程等待时间做微调。

**补充参数建议：**
- workQueue 不要用无界 `LinkedBlockingQueue`，否则 maxPoolSize 永远不会生效，内存可能被撑爆。推荐 `ArrayBlockingQueue` 或在 `Executors` 基础上显示的设置容量。
- `keepAliveTime` 建议设为 60s，允许大于 corePoolSize 的线程空闲后被回收，避免峰值后残留大量线程。
- 始终在 `Executors` 工具类的基础上自己显式 `new ThreadPoolExecutor`，避免隐式的无界队列或过大的最大线程数。

**加分项：** 提及 JFR 中可以观察线程池的 `ThreadPoolExecutor` 事件（任务提交、开始、结束时间），用于分析线程池瓶颈；提及 `ForkJoinPool` 在 Java 8+ 作为默认 parallelStream 线程池，其工作窃取（Work-Stealing）机制与 `ThreadPoolExecutor` 的共享工作队列有本质区别；提及 `Virtual Threads`（Java 21+）对线程池配置逻辑的颠覆 —— 虚拟线程几乎可以无限制创建，IO 密集型任务不再需要精确计算线程数。

---

## Q8：线程池最大线程数什么时候能拉满？CallerRunsPolicy有什么风险？

### 考察点
考察对线程池扩容机制的边界条件理解，以及 `CallerRunsPolicy` 在生产环境中可能引发的连锁故障的认识深度。

### 解答思路
1. 先讲清楚 maxPoolSize 被"激活"的条件：workQueue 必须是有限的，且任务提交速度快于消费速度。
2. 用具体例子说明 CallerRunsPolicy 的风险场景：服务端线程池、TCP 反压失效、线程暴增等。
3. 给出实际生产的最优配置建议和防护措施。

### 参考答案

**maxPoolSize 什么时候能拉满？**

关键条件是：**workQueue 已经满了**。线程池的扩容逻辑是：当 core 线程全忙且 workQueue 满了之后，才会创建新的线程（直到达到 maxPoolSize）。如果 workQueue 是无界队列（如 `newFixedThreadPool` 使用的 `LinkedBlockingQueue` 默认容量为 `Integer.MAX_VALUE`），那么 workQueue 永远不会满，maxPoolSize **形同虚设**，线程数永远不会超过 corePoolSize。这就是很多开发者设了 maxPoolSize 却从来没有生效的原因。

具体拉满的场景：假设 corePoolSize=4, maxPoolSize=8, workQueue 是一个容量为 100 的 `ArrayBlockingQueue`。当任务提交速率 > 消费速率时：前 4 个任务由 core 线程执行 -> 第 5-104 个任务进入 workQueue -> 第 105 个任务到来时 workQueue 已满，创建第 5 个核心外线程 -> 依次创建到第 8 个线程（maxPoolSize）-> 第 109+ 个任务触发饱和策略。

**CallerRunsPolicy 的风险分析：**

`CallerRunsPolicy` 的机制是：当线程池和队列都满了，提交任务的线程自己执行该任务（`r.run()`），从而降低任务提交速度，形成自然的限流。

看似完美的设计，但存在严重隐患：

1. **服务端线程池被反压后拖垮整体响应**：假设 Tomcat 的请求线程（NIO 线程）提交任务到业务线程池时触发 CallerRunsPolicy，Tomcat 线程被迫自己执行耗时业务逻辑，导致该线程无法及时返回去处理新的 HTTP 请求，Tomcat 的 acceptor 和 worker 线程全部被阻塞，整体吞吐量急剧下降。

2. **级联阻塞**：A 服务调用 B 服务，B 服务的 Dubbo 线程池触发 CallerRunsPolicy，导致 Dubbo 线程被阻塞在业务逻辑上，A 服务的调用超时链式增长，形成雪崩。

3. **与异步化设计矛盾**：很多接口用线程池隔离是为了异步化 —— 主线程提交任务后快速返回。CallerRunsPolicy 把异步又退化成了同步，不仅响应变慢，还可能导致接口超时。

4. **线程上下文污染**：调用方线程（如 Dubbo 线程）执行任务时，ThreadLocal 中可能存在调用方的上下文信息（traceId、用户信息），如果任务执行中操作 ThreadLocal，可能产生数据错乱。

**生产最佳实践：**

| 做法 | 说明 |
|---|---|
| 使用有界队列 + 明确 maxPoolSize | 永远不要使用无界队列 |
| CallerRunsPolicy + 监控告警 | 结合 Sentry/Prometheus 记录拒绝事件，设置阈值告警 |
| 服务端慎用 CallerRunsPolicy | Tomcat/Nginx/Netty IO 线程触发 CallerRuns 是致命的 |
| 考虑 AbortPolicy + 降级返回 | 对实时请求，快速失败 > 阻塞等待。配合断路器使用 |
| 独立线程池隔离 | 不同优先级/耗时/IO密集度的任务使用不同线程池，避免互相影响 |
| 动态调整线程池 | 使用美团 Dynamic ThreadPool 或自定义方案，运行时调整 core/max/queue 参数，避免重启 |

**推荐组合：** `corePoolSize=N`, `maxPoolSize=2N`, `ArrayBlockingQueue(500)`, `AbortPolicy` + 监控，对拒绝的任务降级返回友好提示或 fallback 数据，而不是阻塞调用方线程。

**加分项：** 提及美团技术博客中关于动态线程池优化的实践（线程池配置参数可以动态调整并持久化到配置中心）、Sentinel 的线程池隔离与熔断降级机制、以及如何通过 `ThreadPoolExecutor.beforeExecute` 和 `afterExecute` 钩子方法实现线程池级别的全链路追踪（传递 traceId/spanId）；提及 RSS（Resident Set Size）内存与线程数的关系 —— 每个 Java 线程默认 1MB 栈空间，maxPoolSize 过大可能导致 OOM。

---

## Q9：创建线程有几种方式？Java中线程间数据同步怎么做？

### 考察点
考察对线程生命周期管理的全面理解，以及多线程间数据同步机制在生产环境中的选型能力。

### 解答思路
1. 从 JDK 演进角度梳理线程创建方式（Thread -> Runnable -> Callable -> ExecutorService -> Virtual Thread），说明每种方式的历史意义和适用场景。
2. 分类总结 Java 中线程间数据同步的三大机制（互斥同步、非阻塞同步、无同步方案），给出对比表格。
3. 结合生产经验给出最佳实践建议。

### 参考答案

**线程创建的几种方式：**

| 方式 | JDK 版本 | 特点 | 生产推荐度 |
|---|---|---|---|
| 继承 `Thread` 类，重写 `run()` | 1.0 | 单继承限制，无法复用线程 | 不推荐 |
| 实现 `Runnable` 接口 | 1.0 | 无返回值，无法抛受检异常 | 配合线程池可用 |
| 实现 `Callable<T>` + `FutureTask` | 1.5 | 有返回值，可抛异常 | 推荐 |
| 通过 `ExecutorService` 线程池 | 1.5 | 线程复用，生命周期管理 | 强烈推荐 |
| 通过 `ThreadFactory` | 1.5 | 统一命名、守护线程设置、优先级控制 | 强烈推荐 |
| `Virtual Thread`（虚拟线程） | 21 | 轻量级，无需池化，高 IO 并发 | 新项目推荐 |

生产上不推荐直接 `new Thread()`，而应通过 `ThreadFactory`（统一命名便于排查）+ `ExecutorService`（生命周期管理）创建。

**线程间数据同步的三大类方案：**

1. **互斥同步（悲观锁）**：`synchronized`（JVM 内置，锁升级自动）、`ReentrantLock`（API 层，限时等锁、可中断、公平锁）、`ReentrantReadWriteLock`（读写分离）。适合临界区竞争大的场景。

2. **非阻塞同步（乐观锁/CAS）**：`AtomicInteger`、`AtomicReference`、`LongAdder`（高并发写优于 AtomicLong）、`VarHandle`（JDK 9+，对标 `Unsafe` 但更安全）。适合竞争小、临界区极短的场景。

3. **无同步方案（线程封闭）**：`ThreadLocal`（线程私有副本）、`StackClosed`（局部变量天然线程安全）、`Immutable Object`（`final` + 不可变类，天然线程安全，如 `String`、`BigDecimal`）。

**生产经验：** 一个常见的错误是滥用 `synchronized` 保护整个方法体。应只锁临界区，把非关键代码（如日志打印、参数校验）移出同步块。另一个经验是：能用不可变对象解决的线程安全问题，就不要上锁 —— `final` 字段 + 构造函数初始化完成后对象的可见性由 JMM 保证（`final` 字段的"冻结"语义），无运行时开销。

**加分项：** 提及 `VarHandle`（JDK 9+）作为 `Unsafe` 的替代方案，提供更安全的 CAS、内存屏障操作（`acquire`/`release`/`opaque`），比 `AtomicXxx` 粒度更细；提及 Project Loom 的虚拟线程对传统线程创建思维的颠覆 —— 100 万个虚拟线程同时运行不再是问题，线程创建的边际成本从 MB 级降到 KB 级。

---

## Q10：Thread对象、虚拟线程和操作系统线程的对应关系？线程崩掉后是整个进程退出，还是可由其他线程捕获处理？

### 考察点
考察线程模型的底层映射关系，以及 JVM 对线程异常的处理机制与操作系统信号处理的内在联系。

### 解答思路
1. 梳理 Thread 对象、虚拟线程、OS 线程三者的映射模型变化（1:1 -> M:N），用图示或对比说明。
2. 解释线程异常类型及其影响范围（普通异常、OOM、StackOverflow、SIGSEGV）。
3. 给出 UncaughtExceptionHandler 的执行时机与局限性，以及生产环境的容错实践。

### 参考答案

**Thread 对象、虚拟线程与 OS 线程的对应关系：**

| 线程类型 | JDK 版本 | 映射模型 | 调度者 | 栈内存 | 创建/切换开销 |
|---|---|---|---|---|---|
| 传统平台线程（Platform Thread） | 1.0+ | 1:1 | OS 内核调度器 | ~1MB（可配置 `-Xss`） | 高（内核态切换） |
| 虚拟线程（Virtual Thread） | 21 | M:N | JVM 用户态调度器（`ForkJoinPool` 的 carrier thread） | 几 KB（堆上分配，可动态增长） | 极低（用户态切换） |

传统平台线程 (Thread) 直接封装了一个 OS 内核线程（如 Linux 的 pthread），数量受 OS 限制（Linux 默认 pid_max=4194304，但实际受内存限制），创建 1 万个线程大约需要 10GB 栈空间。

虚拟线程是 JVM 内部管理的轻量级对象，不能直接映射到某个固定的 OS 线程。JVM 维护一个 carrier thread pool（默认 `ForkJoinPool` 的 core = CPU 核数），虚拟线程在 carrier 上"搭载"执行。当虚拟线程发生阻塞（如 IO、sleep、等待锁），JVM 将其从 carrier 上"卸载"（unmount），carrier 去执行其他虚拟线程，从而实现"阻塞不占线程"的效果。当一个 carrier thread 执行一个虚拟线程时，两者是 1:1 的临时绑定关系，但不是永久映射。

用一句话总结：传统 Thread = 1 个 Java 对象 : 1 个 OS 线程；虚拟线程 = N 个 Java 对象 : M 个 carrier 线程 : M 个 OS 线程（M 远小于 N）。

**线程崩掉后进程是否退出？**

核心结论：**线程内的普通异常（包括 RuntimeException、OOM 在堆上分配失败）不会导致整个进程退出，但某些致命错误会。**

| 异常类型 | 进程行为 | 原因 |
|---|---|---|
| 普通 `RuntimeException`（NPE、ArithmeticException 等） | 仅当前线程终止 | JVM 在线程退出前调用 `dispatchUncaughtException` |
| `OutOfMemoryError`（堆 OOM） | 仅当前线程终止（多数情况） | 分配失败线程抛 Error，其他线程可能仍可运行 |
| `StackOverflowError` | 仅当前线程终止 | 该线程栈空间耗尽，不影响其他线程 |
| `SIGSEGV`（Native Crash） | **整个 JVM 进程崩溃** | JNI 野指针、Native 代码 bug 导致 OS 发送终止信号 |
| `SIGKILL` / `OOM Killer` | **整个进程被杀死** | 操作系统级别的进程终止，JVM 无法拦截 |
| `VirtualMachineError`（某些子类） | 取决于严重程度 | 可能需要 `-XX:+ExitOnOutOfMemoryError` 才会退出 |

**UncaughtExceptionHandler 机制：** 通过 `Thread.setDefaultUncaughtExceptionHandler()` 或 `setUncaughtExceptionHandler()`，可以在线程因未捕获异常而终止时执行清理逻辑（打日志、发告警、资源回收）。但它只能处理 JVM 层面的异常，对 Native Crash 无能为力。生产上建议在 `ThreadFactory` 中统一设置，并为线程池定制 `afterExecute` 钩子配合使用。

**生产最佳实践：**
1. 每个线程都设置 UncaughtExceptionHandler，至少记录异常信息，避免"静默死亡"。
2. 线程池任务的异常被 `Future.get()` 包装成 `ExecutionException`，不要忘记处理。
3. 关键服务需要进程级守护（supervisor、systemd、K8s health check），因为 JVM 内部的异常处理总归有覆盖不到的场景。

**加分项：** 提及 Linux 信号与 JVM 的交互 —— `SIGSEGV` 的 `hs_err_pid.log` 文件解读、`-XX:OnError` / `-XX:OnOutOfMemoryError` 的故障自愈脚本；提及虚拟线程的 `Thread.Builder.uncaughtExceptionHandler` 设置方式与传统线程一致，但因为虚拟线程数量极大，异常处理策略需要考虑日志量爆炸的问题。

---

## Q11：虚拟线程（Virtual Thread）与平台线程的区别？使用场景？

### 考察点
考察 Java 21 新特性在解决高并发 IO 场景下线程资源瓶颈的底层理解，以及对传统线程池架构设计冲击的认知。

### 解答思路
1. 从底层实现机制对比虚拟线程和平台线程（栈内存、调度模型、阻塞行为）。
2. 给出场景选择矩阵，明确什么场景该用虚拟线程，什么场景不该用。
3. 结合生产踩坑经验，说明虚拟线程的局限性和与现有生态（synchronized、ThreadLocal、线程池）的兼容性问题。

### 参考答案

**核心区别对比：**

| 维度 | 平台线程（Platform Thread） | 虚拟线程（Virtual Thread） |
|---|---|---|
| 内存占用 | ~1MB 栈空间（`-Xss` 控制） | ~200-300 字节对象头 + 动态伸缩的栈（堆上） |
| 数量上限 | ~10000（受内存限制） | 数百万（理论无上限） |
| 调度器 | OS 内核（抢占式） | JVM 用户态调度器（协作式，在阻塞点切换） |
| 阻塞行为 | 线程真正阻塞，释放 CPU，但栈和线程资源不可复用 | 从 carrier thread unmount，释放 carrier 去干别的，虚拟线程自身堆栈保留 |
| 上下文切换 | 内核态切换，~10-30μs | 用户态切换，~ns 级 |
| 创建耗时 | ~1ms（分配栈空间 + 内核线程注册） | ~1μs（堆上分配对象） |
| 线程 ID | OS 层面的 tid（`ps -T` 可见） | JVM 内部 ID，OS 不可见 |
| 适用模式 | 适合 CPU 密集型、需要线程本地状态的管理 | 适合 IO 密集型、高并发等待型任务 |

**技术要点：** 虚拟线程的栈是**堆上分配的连续 Java 对象**（底层用 `Continuation` 机制），当虚拟线程阻塞时，JVM 会将当前栈帧的引用保存到堆对象中，从 OS 线程上"卸下来"（unmount），OS 线程可以立刻去执行另一个虚拟线程。当阻塞解除后，JVM 再把虚拟线程"挂载"（mount）到某个空闲的 OS 线程上继续执行。整个过程对 Java 代码完全透明。

**使用场景指南：**

| 场景 | 推荐方案 | 原因 |
|---|---|---|
| HTTP 服务处理大量并发请求（每个请求都查 DB/调 RPC） | 虚拟线程 | 请求处理线程大部分时间在等 IO，virt 线程阻塞不占 OS 线程 |
| 数据库连接池中的 worker | 虚拟线程 | 等待 DB 返回结果时可以被 unmount |
| 消息队列并发消费（Kafka/RabbitMQ） | 虚拟线程（谨慎评估） | 需考虑 Consumer 线程模型的适配性 |
| 纯 CPU 密集计算（图像处理、加密） | 平台线程池 | 虚拟线程不能加速计算本身，线程切换无收益 |
| `synchronized` 重度使用的遗留代码 | 平台线程池（或改用 `ReentrantLock` 后再迁移） | 虚拟线程在 `synchronized` 块中阻塞时会**钉死**（pin）carrier 线程，导致 carrier 线程被浪费 |
| ThreadLocal 重度依赖的框架 | 评估迁移成本 | 大量虚拟线程持有 ThreadLocal 会导致内存膨胀 |

**生产踩坑经验：**

1. **synchronized 的"钉死"问题**：虚拟线程在执行 `synchronized` 代码块时如果调用阻塞操作（如 IO），由于 JVM 的 monitor 实现与 OS 线程绑定，虚拟线程无法从 carrier 上 unmount，导致 carrier 被"钉死"在这个虚拟线程上无法复用。解决方案是：将 `synchronized` 替换为 `ReentrantLock`（JDK 21 对 `ReentrantLock` 做了适配，支持虚拟线程的 unmount）。

2. **线程池不适用虚拟线程**：虚拟线程的设计初衷就是"不需要池化"，极低的创建成本使得按需创建/销毁更合理。用虚拟线程跑在线程池里反倒是绕了一圈，限制了并发能力。推荐用 `Executors.newVirtualThreadPerTaskExecutor()` 或 `Thread.ofVirtual().start()`。

3. **ThreadLocal 陷阱**：在平台线程池模型下，`ThreadLocal` 常常被用来缓存昂贵对象（如 `SimpleDateFormat`）。迁移到虚拟线程后，每个请求可能创建一个新的虚拟线程，`ThreadLocal` 变得"不通用"了，需要显式清理或者改用 ScopedValue（JDK 20+ incubator，类似 Loom 原生支持的不可变线程本地变量）。

4. **连接池不必过大**：虚拟线程模式下，连接池维度不再受"一个线程等一个连接"的限制，连接池大小只需根据数据库承受能力设定，不再由线程数决定。

**加分项：** 提及 `ScopedValue`（JDK 20 incubator -> 22 preview）是虚拟线程时代的 ThreadLocal 替代方案（不可变、自动清理、调用链传递）；提及 Pin 问题的监控方法（`-Djdk.tracePinnedThreads=full` 可以输出被钉住的调用栈）；提及虚拟线程与 Reactive/异步编程的对比 —— 虚拟线程让代码保持同步风格的同时获得异步的并发效果，可能终结"每个 IO 操作用 CompletableFuture 组合"的时代。

---

## Q12：在多线程环境下，如何保证一个变量的可见性与有序性？

### 考察点
考察 JMM（Java 内存模型）核心 Happens-Before 规则的体系化理解，以及在实践中如何组合使用 volatile、synchronized、final、锁等手段保证变量在多线程下的正确性。

### 解答思路
1. 先给出"可见性"和"有序性"的准确定义（不能停留在表面概念），引出一个共享变量在多线程环境下"读错值"的三种根因。
2. 列出 JMM 中保证可见性和有序性的完整手段矩阵，逐一说明每种手段覆盖了哪些 Happens-Before 规则。
3. 给出生产级选型建议 —— 不同场景下选择不同手段的组合。

### 参考答案

**概念澄清：**

- **可见性（Visibility）**：一个线程对共享变量的修改，能否被其他线程及时看到。核心问题是 CPU 缓存（L1/L2/L3）与主内存的数据同步延迟。
- **有序性（Ordering）**：代码的执行顺序是否与书写顺序一致。核心问题是编译器优化（指令重排、公共子表达式消除）和 CPU 乱序执行。
- 两者加上**原子性（Atomicity）**构成并发编程三大特性。

一个多线程变量"读错值"的三种根因：(1) CPU 缓存没刷到主内存（可见性）；(2) 指令重排导致构造对象的引用提前"逃逸"（有序性）；(3) 类似 `count++` 的复合操作无法原子执行（原子性）。

**保证可见性与有序性的手段矩阵：**

| 手段 | 可见性 | 有序性 | 原理 | 性能开销 | 适用场景 |
|---|---|---|---|---|---|
| `volatile` | 保证（写立即刷主存，读重载） | 部分保证（禁止 volatile 变量与相邻普通变量的重排） | `lock` 前缀指令 + StoreLoad 屏障 | 低（读几乎零开销） | 状态标志位、DCL |
| `synchronized` | 保证（解锁前刷主存） | 保证（加锁后后续读不重排到锁前） | monitor enter/exit + 内存屏障 | 中-高（竞争时） | 临界区保护 |
| `Lock` API | 同 `synchronized` | 同 `synchronized` | AQS (`AbstractQueuedSynchronizer`) 内部的 `volatile int state` | 中-高 | 需要限时等锁、中断等特性 |
| `final` 字段 | 保证（构造完成后 freeze） | 保证（`this` 引用逃逸除外） | JMM final 字段语义 | 零 | 不可变对象 |
| `AtomicXxx` | 保证（底层 `volatile`） | 保证 | CAS + `volatile` | 低 | 计数、状态机 |
| `VarHandle` (acquire/release) | 保证 | 保证 | 精确控制屏障级别 | 低-中 | 高性能无锁数据结构 |
| Thread sleep/join/start | 保证（`start()` 之前的写对子线程可见；`join()` 之后的读能看到已终止线程的写） | 保证 | JMM Happens-Before 规则 | N/A | 线程协作 |

**Happens-Before 规则速记（8 条）：**

1. **程序次序规则**：同一个线程内，前面的操作 Happens-Before 后面的操作。
2. **volatile 规则**：对一个 `volatile` 变量的写 Happens-Before 后续对这个 `volatile` 变量的读。
3. **锁规则**：对一个锁的解锁 Happens-Before 后续对这个锁的加锁。
4. **线程启动规则**：`Thread.start()` Happens-Before 该线程的每个动作。
5. **线程终止规则**：线程中的所有操作 Happens-Before 其他线程检测到该线程终止（`join`、`isAlive`）。
6. **线程中断规则**：对线程 `interrupt()` 的调用 Happens-Before 被中断线程检测到中断事件。
7. **对象终结规则**：对象的构造函数 Happens-Before `finalize()` 方法。
8. **传递性**：A Happens-Before B, B Happens-Before C => A Happens-Before C。

**生产选型经验：**

| 场景 | 推荐方案 | 原因 |
|---|---|---|
| 开关/状态标志（如 `running = false` 停止线程） | `volatile boolean` | 只有写-读关系，不需要互斥 |
| 多字段一致性（如转账：扣 A 账户+加 B 账户） | `synchronized` 或 `ReentrantLock` | 需要保证"扣-加"的原子性+可见性+有序性 |
| DCL 单例的 `instance` | `volatile` 或利用类初始化锁（按需初始化 Holder 类） | 防止半初始化对象对其它线程可见 |
| 高性能计数器 | `LongAdder` | 热点分散，高并发写优于 `AtomicLong` |
| 不可变配置对象 | `final` 字段 + 安全发布（`volatile` 引用或 `CopyOnWriteArrayList`） | `final` 字段构造完后 freeze，零成本线程安全 |
| 并发容器的状态管理 | 容器内部已处理（`ConcurrentHashMap` 内部用 `volatile` + `synchronized` + CAS） | 不需要应用层额外处理 |

**加分项：** 提及 `jctools` 和 `disruptor` 这类高性能无锁队列中 `VarHandle.acquire` / `VarHandle.release` 的精确内存屏障用法（比 `volatile` 的 full barrier 更轻量）；提及 JIT 逃逸分析（Escape Analysis）对锁消除的优化 —— 如果对象不会"逃逸"出当前线程，`synchronized` 在 JIT 编译后可能被完全消除；提及 `@Contended` 注解解决伪共享（False Sharing）对可见性的影响 —— 不是可见性问题但影响性能。

---

## Q13：synchronized加锁后临界区抛出OOM或异常，锁自动释放还是手动处理？

### 考察点
考察 synchronized 的异常安全性（Exception Safety）底层机制，以及 JVM 规范对 monitorenter/monitorexit 的保证程度。

### 解答思路
1. 从 JVM 字节码层面解释 synchronized 的异常表（Exception Table）如何保证锁一定被释放。
2. 区分"锁释放了"和"数据状态没问题"两个不同层次的问题。
3. 对比 `ReentrantLock` 在异常下的行为差异，以及 `try-finally` 的必要性。

### 参考答案

**核心结论：`synchronized` 在抛出任何异常（包括 OOM）后，锁会被 JVM 自动释放。不需要手动处理。**

**字节码层面的保障：**

Java 编译器在编译 `synchronized` 代码块时，会在字节码中生成一个**隐式的 try-finally 结构**。具体来说：

```java
// Java 源码
synchronized (lock) {
    doSomething();  // 这里可能抛出异常
}
```

编译后的字节码逻辑等效于：

```
monitorenter      // 获取锁
try {
    doSomething();
} finally {
    monitorexit    // 无论是否发生异常，都会执行
}
```

JVM 会在方法的异常表（Exception Table）中注册一个条目：覆盖从 `monitorenter` 后到 `monitorexit` 前的整个区域，无论发生什么类型的异常（包括 `OutOfMemoryError`、`StackOverflowError` 等 Error），都会跳转到 `monitorexit` 指令释放锁。

对于 `synchronized` 实例方法/静态方法，JVM 通过在方法的 `Code` 属性中标记 `ACC_SYNCHRONIZED` 标志位，让 JVM 在方法调用时自动执行 monitorenter，在方法返回（正常或异常）时自动执行 monitorexit，原理相同。

**关键区分：锁释放不等于数据状态正确。**

虽然锁一定会释放，但临界区内的数据可能处于**不一致状态**。举一个典型的例子：

```java
synchronized (accountLock) {
    accountA.balance -= 100;   // 扣 A 成功
    accountB.balance += 100;   // 这里如果抛出 OOM，B 还没加
}
// 此时锁已经释放，但 A 被扣了 100，B 没加上，数据不一致！
// 锁只是释放了，并发安全恢复了，但业务数据已经脏了
```

更危险的是 OOM 场景：`synchronized` 保证了锁释放，但 OOM 之后的 JVM 状态非常不可靠 —— 可能 GC 多次失败，其他线程也处于半死不活的状态，这种情况下进程重启往往是更安全的选择（`-XX:+ExitOnOutOfMemoryError`）。

**`ReentrantLock` vs `synchronized` 在异常安全性上的对比：**

| 维度 | `synchronized` | `ReentrantLock` |
|---|---|---|
| 异常时锁释放 | JVM 保证自动释放 | 需要 `try { lock.lock(); ... } finally { lock.unlock(); }` |
| 忘记 finally unlock | 不适用（自动） | 锁永远不释放，死锁 |
| 异常时数据一致性 | 不保证（只保证锁释放） | 不保证（需要业务回滚逻辑） |
| OOM 行为 | 锁释放，JVM 可能不稳定 | 同左 |

**生产最佳实践：**

1. **临界区尽量短**，缩短中间状态窗口。
2. **先做预校验再进锁**，减少锁内抛异常的概率（如先验证参数、预分配内存）。
3. **锁内做业务补偿**：使用"修改前快照 + 异常时回滚"模式，但实现成本高，仅在一致性要求极强的场景使用。
4. **OOM 场景配置 `-XX:+ExitOnOutOfMemoryError`**：与其留有风险地继续运行，不如快速失败重启。
5. **锁住的资源如果涉及外部系统（DB、Redis）**，需要分布式补偿逻辑（如 Seata、Saga 模式），单机锁的释放只是第一步。

**加分项：** 提及 JVMTI（JVM Tool Interface）的 `MonitorContendedEnter` / `MonitorContendedEntered` 事件，可以用于监控线程争用锁的情况；提及 `-XX:+UnlockDiagnosticVMOptions -XX:+PrintAssembly` 可以实际查看 JIT 编译后的 monitorenter/monitorexit 及相关异常表；提及 `Lock.lockInterruptibly()` 在异常场景下的优势 —— 可以被中断而不仅仅是抛出异常，适合需要优雅停机的长任务。

---

## Q14：谈一谈你对CompletableFuture的理解。与Future相比，它解决了哪些痛点？

### 考察点
考察对异步编程范式的演进理解和 `CompletableFuture` 在实际业务中编排异步任务的工程能力，而非仅仅了解 API。

### 解答思路
1. 对比 `Future` 的 5 个典型痛点，说明 `CompletableFuture` 如何逐一解决。
2. 拆解 `CompletableFuture` 的核心设计（CompletionStage 接口、回调链、组合子、异常处理），并用生产级代码示范。
3. 结合工程经验，说明 `CompletableFuture` 的常见坑和最佳实践（线程池选择、超时控制、异常传播）。

### 参考答案

**`Future` 的五大痛点：**

| 痛点 | `Future` 的局限 | `CompletableFuture` 的解决方案 |
|---|---|---|
| 1. 无法手动完成 | 只能等待被提交的任务自然完成 | `complete()` / `completeExceptionally()` 可手动完成 |
| 2. 阻塞式获取结果 | `get()` 阻塞调用线程，无法异步通知 | `thenAccept()` / `thenApply()` 回调链，异步非阻塞 |
| 3. 无法组合多个异步任务 | 想等两个 Future 都完成或任一完成？无能为力 | `thenCombine()` / `allOf()` / `anyOf()` 组合子 |
| 4. 无法链式处理 | 结果出来后还要再异步处理？只能 `get()` 后再提交新任务 | `thenCompose()` / `thenApplyAsync()` 链式编排 |
| 5. 异常处理差 | 只能在 `get()` 时 `try-catch ExecutionException` | `exceptionally()` / `handle()` / `whenComplete()` 声明式异常处理 |

**核心设计理解：**

`CompletableFuture` 实现了 `Future` 和 `CompletionStage` 两个接口。`CompletionStage` 提供了声明式的异步任务编排能力，本质上是一个**有状态的状态机** —— 每个 stage 代表计算的一个步骤，前一个 stage 完成后触发后一个 stage 的回调。

关键 API 分类：

| 类别 | 方法 | 用途 |
|---|---|---|
| 转换 | `thenApply(fn)` / `thenApplyAsync(fn, executor)` | 对结果做同步/异步转换 T -> U |
| 组合 | `thenCompose(fn)` | 等价于 flatMap，连接两个异步调用（第二个依赖第一个结果） |
| 合并 | `thenCombine(other, fn)` | 等两个都完成，合并结果 |
| 消费 | `thenAccept(consumer)` | 消费结果，不返回 |
| 异常恢复 | `exceptionally(fn)` / `handle(biFn)` | 在异常时提供 fallback |
| 等待 | `allOf(...)` / `anyOf(...)` | 等全部/任一完成 |
| 手动完成 | `complete(val)` / `completeExceptionally(ex)` | 外部触发完成 |

**生产级代码范例（电商下单）：**

```java
// 一个下单接口需要：查库存、查用户、算价格（三个并行）-> 汇总 -> 创建订单
CompletableFuture<Integer> stockF = 
    CompletableFuture.supplyAsync(() -> stockService.queryStock(productId), ioPool);
CompletableFuture<User> userF = 
    CompletableFuture.supplyAsync(() -> userService.getUser(userId), ioPool);
CompletableFuture<Price> priceF = 
    CompletableFuture.supplyAsync(() -> priceService.calcPrice(productId), ioPool);

CompletableFuture<Void> result = CompletableFuture.allOf(stockF, userF, priceF)
    .thenApplyAsync(v -> {
        // 三个都完成，汇总
        return orderService.create(stockF.join(), userF.join(), priceF.join());
    }, ioPool)
    .orTimeout(3, TimeUnit.SECONDS)          // JDK 9+：3 秒超时
    .exceptionally(ex -> {
        log.error("下单失败", ex);
        return Order.fallback();
    });
```

**生产常见坑与最佳实践：**

1. **线程池孤立**：`thenApplyAsync()` 默认用 `ForkJoinPool.commonPool()`（CPU 核数 - 1 个线程）。如果任务是 IO 密集型的，commonPool 很快会被耗尽，导致所有默认池的 `CompletableFuture` 全部卡死。**强烈建议显式传入自定义线程池**。

2. **`join()` vs `get()`**：`join()` 抛出 `CompletionException`（unchecked），`get()` 抛出 `ExecutionException`（checked）。链式调用中推荐用 `join()`，避免大量 try-catch。

3. **异常吞没**：如果链末没有任何 `exceptionally()` 或 `handle()`，异常只会被保存在 `CompletableFuture` 内部，不会打印日志。直到有人调用 `get()` 才会暴露。建议链末始终加 `exceptionally()` 或 `whenComplete()`。

4. **`allOf()` 返回 `CompletableFuture<Void>` 无法直接拿结果**：需要额外调用 `stockF.join()`，代码可读性变差。可封装一个工具方法 `allOfWithResult()` 或使用第三方库如 Reactive 框架。

5. **回调执行线程的不确定性**：`thenApply()` 默认在前一个 stage 完成的线程上执行（可能是调用方线程）。如果回调逻辑很重，会导致上游线程阻塞，应使用 `thenApplyAsync()` 切换到业务线程池。

6. **超时控制**（JDK 9+ `orTimeout`/`completeOnTimeout`）：JDK 8 没有内置超时，只能靠 `CompletableFuture.supplyAsync(() -> f.get(3, TimeUnit.SECONDS))` 曲线救国。

**加分项：** 提及 Java 21 的 Structured Concurrency（`StructuredTaskScope`，Preview/Incubator），是 `CompletableFuture.allOf()` 的进化 —— 提供了"结构化"的并发控制，子任务的生命周期被限定在父作用域中，出错时自动取消兄弟任务，比 `CompletableFuture` 的"忘记取消"更安全；提及 `CompletableFuture` 与响应式编程（Reactor/RxJava）的选型 —— 少于 3 层异步嵌套用 CF，超过 3 层或需要背压/流式处理考虑响应式。

---

## Q15：多个子线程全部运行完后主线程才能往下走，有几种实现方式？CountDownLatch底层怎么实现？

### 考察点
考察"线程协调/同步屏障"的多种实现方案，以及 AQS 框架的底层实现原理在生产场景中的选型和调优能力。

### 解答思路
1. 枚举至少 5 种实现"等待多个子线程完成"的方式，对比适用场景和优缺点。
2. 深入 `CountDownLatch` 的 AQS 底层实现（`Sync` 内部类、`tryAcquireShared`、`tryReleaseShared`）。
3. 给出 `CountDownLatch` 的常见误用场景和生产实践经验。

### 参考答案

**多种实现方式对比：**

| 方案 | 核心 API | 是否可复用 | 能否获取子线程返回值 | 适用场景 |
|---|---|---|---|---|
| `Thread.join()` | `thread.join()` | 不可复用 | 否（需用共享变量） | 线程数少、不需要线程池 |
| `CountDownLatch` | `await()` / `countDown()` | 不可复用（一次性） | 否 | 等待 N 个子任务完成，经典"发令枪" |
| `CyclicBarrier` | `await()` | **可复用**（reset 后） | 否（可在 barrier action 中汇总） | 多线程相互等待到齐后再一起执行 |
| `ExecutorService.invokeAll()` | `invokeAll(tasks)` | 不可复用 | 是（返回 `List<Future<T>>`） | 在线程池中提交批量任务 |
| `CompletableFuture.allOf()` | `allOf(futures).join()` | 不可复用 | 是（通过各 future 的 `join()` 获取） | 异步任务编排 |
| `Phaser`（JDK 7+） | `register()` / `arriveAndAwaitAdvance()` | 可复用 | 否 | 分阶段的多方协调 |
| `ForkJoinTask.join()` / `invokeAll()` | `fork()` / `join()` / `invokeAll()` | 可复用（ForkJoinPool） | 是（任务返回值） | 分治计算，支持工作窃取 |

**生产选型指南：**

- 简单等 N 个线程，不要返回值：`CountDownLatch`
- 等 N 个线程，要返回值：`ExecutorService.invokeAll()` 或 `CompletableFuture.allOf()`
- 多线程阶段性协同：`CyclicBarrier`（比如多个线程各自读一部分数据，全部读完后再一起处理）
- 分治计算（多核 CPU 密集）：`ForkJoinPool.invokeAll()`（利用工作窃取平衡负载）

**`CountDownLatch` 底层实现（AQS）：**

`CountDownLatch` 的核心代码非常精炼，完全基于 `AbstractQueuedSynchronizer`（AQS）实现：

```java
// CountDownLatch 内部 Sync 继承 AQS
private static final class Sync extends AbstractQueuedSynchronizer {
    Sync(int count) { setState(count); }  // state = 初始计数
    
    // tryAcquireShared：尝试获取共享锁（await 调用）
    protected int tryAcquireShared(int acquires) {
        return (getState() == 0) ? 1 : -1;
        // 状态=0 表示可以通行；状态>0 需要阻塞等待
    }
    
    // tryReleaseShared：尝试释放共享锁（countDown 调用）
    protected boolean tryReleaseShared(int releases) {
        for (;;) {   // CAS 自旋
            int c = getState();
            if (c == 0) return false;    // 已经是 0，不能再减
            int nextc = c - 1;
            if (compareAndSetState(c, nextc))
                return nextc == 0;       // 减后为 0 则唤醒所有等待线程
        }
    }
}
```

**执行流程：**

1. 初始化：`new CountDownLatch(5)` -> AQS 的 `state` 设为 5。
2. 主线程调用 `await()` -> 进入 AQS 的 `acquireSharedInterruptibly()` -> 调用 `tryAcquireShared()` -> state != 0 返回 -1 -> 主线程被包装成 Node 加入 AQS 的 **CLH 等待队列**（双向链表），然后 `LockSupport.park()` 挂起。
3. 子线程完成任务后调用 `countDown()` -> 进入 AQS 的 `releaseShared()` -> 调用 `tryReleaseShared()` -> CAS 将 state 减 1 -> 当 state 减到 0 时返回 true -> AQS 调用 `doReleaseShared()` **唤醒 CLH 队列中所有等待的线程** —— 注意是传播式唤醒（共享模式的特性），不同于排他锁只唤醒队列头部的一个线程。
4. 主线程被唤醒，重新尝试 `tryAcquireShared()` -> state == 0 返回 1 -> 主线程从 `await()` 返回，继续执行。

**AQS CLH 队列示意图：**

```
head (dummy) <-> Node(main thread, waitStatus=SIGNAL) <-> Node(other thread)
                    ^
                    |
             主线程 park 在此，等待被唤醒
```

**生产常见误用：**

1. **`countDown()` 在 `try-catch` 的 catch 块外**：如果子线程抛异常，`countDown()` 被跳过，state 永远不归零，主线程永久阻塞。**务必写在 finally 块中。**
2. **`countDown()` 被多次调用**：`CountDownLatch` 不会阻止 state 减到负数，同一个线程调两次 `countDown()` 会导致计数提前归零，主线程提前放行。需要额外逻辑保证"一个任务只 countDown 一次"。
3. **`CountDownLatch` 不可复用**：state 归零后没法再恢复到初始值。如果需要重置，用 `CyclicBarrier`。
4. **大数据量场景超时**：`await(long timeout, TimeUnit unit)` 建议始终设置超时，避免永久卡死。

**加分项：** 对比 AQS 共享模式（`CountDownLatch`、`Semaphore`）与排他模式（`ReentrantLock`）在队列唤醒机制上的差异 —— 共享模式是链式传播唤醒（被唤醒的节点会继续唤醒下一个），排他模式只唤醒 head 的下一个节点；提及 `CountDownLatch` 在高并发下的一个性能优化 —— `doReleaseShared()` 中的"快路径"与自旋避免频繁 park/unpark 的开销；提及用 `Phaser` 替代 `CountDownLatch` 的场景 —— 多个阶段、动态注册参与者数量的协调。

---

## Q16：ThreadLocal是什么？为什么使用？会产生什么问题？

### 考察点
考察 ThreadLocal 的底层实现（ThreadLocalMap、Entry 的弱引用设计）、内存泄漏的根因，以及在线程池模型中导致的数据错乱问题的工程解决方案。

### 解答思路
1. 从"线程封闭"的设计理念出发，说明 ThreadLocal 解决了什么根本问题（无锁线程安全 + 隐式传参）。
2. 深入 ThreadLocal 的底层数据结构 —— `Thread.threadLocals` -> `ThreadLocalMap` -> `Entry(WeakReference<ThreadLocal>, value)`，解释为什么 ThreadLocal 用弱引用、以及内存泄漏的根因。
3. 列出 ThreadLocal 在工程中的三大类问题（内存泄漏、线程池数据错乱/脏数据、跨线程传递），逐一给出解决方案。

### 参考答案

**`ThreadLocal` 是什么？**

`ThreadLocal` 是 Java 提供的**线程封闭（Thread Confinement）**机制：每个线程拥有变量的独立副本，线程之间互不干扰，天然线程安全。它在 JDK 层面实现了一种"空间换锁"的策略 —— 用多份副本的内存开销替代了加锁的性能开销。

**为什么使用 ThreadLocal？两大核心场景：**

| 场景 | 示例 | 原理 |
|---|---|---|
| 1. 隐式传参（避免参数层层传递） | 全链路追踪 traceId、用户上下文、租户 ID、语言/时区 | 放入 ThreadLocal，后续任何方法（包括无法修改签名的第三方库方法）都能获取 |
| 2. 无锁线程安全（避免共享竞争） | `SimpleDateFormat` 的线程不安全问题、数据库连接（`Connection`）的线程绑定、`Random` 的种子竞争 | 每个线程一个独立对象，无需加锁 |

**底层实现剖析：**

ThreadLocal 的数据存储不是放在 ThreadLocal 对象自身，而是放在每个 `Thread` 对象中：

```java
// Thread 对象中持有
ThreadLocal.ThreadLocalMap threadLocals = null;  // 默认 null，惰性创建

// ThreadLocalMap 的内部 Entry
static class Entry extends WeakReference<ThreadLocal<?>> {
    Object value;  // 强引用，存着实际的值（如 traceId 字符串）
}
```

`ThreadLocalMap` 是一个**自定义的哈希表**，用**线性探测法（Linear Probing）**解决哈希冲突，而不是 `HashMap` 的拉链法。设计如此是因为：Entry 的 key (ThreadLocal 对象) 是弱引用，容易被 GC 回收，线性探测法在遇到"过期" Entry（key 被回收）时需要清理，拉链法的链表维护在清理时更复杂。

**为什么 ThreadLocal 的 key 用弱引用？**

如果 key 用强引用：当业务代码不再持有 ThreadLocal 对象时，只要 Thread 还活着（线程池中的线程基本永远活着），`threadLocals` map 中的 key 就无法被 GC，value 也跟着泄漏。

用 `WeakReference<ThreadLocal>` 作为 key：当 ThreadLocal 对象的强引用被置 null，下次 GC 时 key 被回收，在 `get()`/`set()`/`remove()` 时 ThreadLocalMap 有机会发现 key == null 的过期 Entry，调用 `expungeStaleEntry()` 清理。

**注意：但这只解决了 key 的问题，value 的强引用链 Thread -> ThreadLocalMap -> Entry -> value 仍然存在！** 如果不在 finally 中调用 `remove()` 显式断开 value 的引用，value 仍然无法被 GC —— 这就是 ThreadLocal 内存泄漏的根本原因。

**三大工程问题与解决方案：**

| 问题 | 根因 | 解决方案 |
|---|---|---|
| **内存泄漏** | ThreadLocal 已无用但 value 仍被 Thread -> ThreadLocalMap -> Entry 强引用链持有 | `remove()` 写在 finally 块（这是铁律！） |
| **线程池脏数据** | 线程池复用线程，上次任务设置的值残留，污染下次任务 | 每次任务结束必须 `remove()`；建议用过滤器/拦截器统一清理 |
| **跨线程传递** | 新线程、异步任务、CompletableFuture 链中拿不到父线程的 ThreadLocal 值 | 使用 `InheritableThreadLocal`、`TransmittableThreadLocal`（阿里开源的 TTL） |

**TransmittableThreadLocal（TTL）的使用场景：**

`InheritableThreadLocal` 只在 `new Thread()` 时传递一次值，在**线程池**场景下完全无效（线程池中的线程是复用的，不会重新 `new Thread()`）。阿里开源的 `TransmittableThreadLocal` 通过 `TtlRunnable` 包装任务，在执行前"快照 + 回放"父线程的上下文值，任务执行后"恢复"线程池线程原有的上下文（防止脏数据），解决了线程池中上下文传递的痛点。此外 Java 21 提供了 `ScopedValue`（Preview -> Incubator），采用不可变 + 结构化生命周期设计，是更优的替代方案。

**生产检查清单：**

1. 所有 ThreadLocal 的 `get()` 之后，`remove()` 是否在 finally 中？
2. 线程池任务执行前后，ThreadLocal 值是否被正确清理？可以用拦截器（Servlet Filter、Dubbo Filter、Spring AOP）统一处理。
3. 项目中是否有"异步调同步"的场景导致 ThreadLocal 断裂？是否需要引入 TTL？
4. 是否限制了 ThreadLocal 变量的数量？每个线程一个 `ThreadLocalMap`，变量太多会膨胀每个线程的内存。
5. 升级 JDK 21+ 后，评估是否能用 `ScopedValue` 替代 ThreadLocal。

**加分项：** 深入图解 ThreadLocalMap 的线性探测清理机制 —— `expungeStaleEntry()` 不仅清理当前过期 Entry，还会探测清理哈希冲突链上的过期 Entry，并 rehash 有效 Entry 保证查找效率；提及 `ScopedValue`（JDK 20 incubator -> 22 preview）的设计优势 —— 不可变、自动清理（离开作用域自动失效）、天然支持结构化并发（`StructuredTaskScope` 中的子任务继承父作用域的 ScopedValue），是 Loom 时代 ThreadLocal 的正统接班人；提及 JDK 中 `Cleaner` 和 `PhantomReference` 的另一种内存泄漏防护思路 —— 当对象被 GC 时回调清理方法。
