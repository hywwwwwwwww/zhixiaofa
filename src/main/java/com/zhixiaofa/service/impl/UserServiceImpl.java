package com.zhixiaofa.service.impl;

import com.zhixiaofa.common.PageResult;
import com.zhixiaofa.common.ResultCode;
import com.zhixiaofa.dao.ContractDao;
import com.zhixiaofa.dao.DocRecordDao;
import com.zhixiaofa.dao.EmailVerifyCodeDao;
import com.zhixiaofa.dao.FavoriteDao;
import com.zhixiaofa.dao.QaRecordDao;
import com.zhixiaofa.dao.SysUserDao;
import com.zhixiaofa.dao.impl.ContractDaoImpl;
import com.zhixiaofa.dao.impl.DocRecordDaoImpl;
import com.zhixiaofa.dao.impl.EmailVerifyCodeDaoImpl;
import com.zhixiaofa.dao.impl.FavoriteDaoImpl;
import com.zhixiaofa.dao.impl.QaRecordDaoImpl;
import com.zhixiaofa.dao.impl.SysUserDaoImpl;
import com.zhixiaofa.exception.BizException;
import com.zhixiaofa.model.EmailVerifyCode;
import com.zhixiaofa.model.SysUser;
import com.zhixiaofa.service.MailService;
import com.zhixiaofa.service.UserService;
import com.zhixiaofa.util.DateUtil;
import com.zhixiaofa.util.PasswordUtil;
import com.zhixiaofa.util.StringUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 用户业务实现。
 *
 * <p>本层承载的业务规则（Servlet 里不应出现这些判断）：</p>
 * <ul>
 *   <li>注册时用户名 / 邮箱唯一性校验、密码强度校验；</li>
 *   <li>密码加盐哈希后再落库，明文不落盘、不进日志；</li>
 *   <li>登录时校验账号状态，并刷新最近登录时间；</li>
 *   <li>找回密码的发码限流（冷却 / 邮箱与 IP 每日上限 / 试错上限）与验证码一次性使用；</li>
 *   <li>删除用户时禁止删除当前登录账号。</li>
 * </ul>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class UserServiceImpl implements UserService {

    private static final Logger log = LoggerFactory.getLogger(UserServiceImpl.class);

    /** 密码最短长度 */
    private static final int PWD_MIN = 6;
    /** 密码最长长度（防止超长输入拖慢哈希） */
    private static final int PWD_MAX = 32;

    /* ---------------- 找回密码验证码策略 ---------------- */

    /** 验证码业务场景 */
    private static final String SCENE_RESET = "RESET_PASSWORD";
    /** 注册验证码场景（与找回密码共用一张表，靠 scene 区分、互不干扰） */
    private static final String SCENE_REGISTER = "REGISTER";
    /** 验证码有效期（分钟），同时决定邮件文案与落库过期时间，只此一处 */
    private static final int CODE_TTL_MINUTES = 5;
    /** 验证码位数 */
    private static final int CODE_LENGTH = 6;
    /** 同一邮箱两次发码的最小间隔（秒） */
    private static final int CODE_INTERVAL_SECONDS = 60;
    /** 同一邮箱 24 小时内最多发码条数 */
    private static final int CODE_MAX_PER_EMAIL = 5;
    /** 同一 IP 24 小时内最多发码条数（防换邮箱绕过邮箱维度的限流） */
    private static final int CODE_MAX_PER_IP = 10;
    /** 同一条验证码最多试错次数，达到即作废（防在线暴力穷举 6 位码） */
    private static final int CODE_MAX_ATTEMPTS = 5;
    /** 过期记录保留时长（小时），超过即随手清理 */
    private static final int CODE_RETENTION_HOURS = 24;

    private static final SecureRandom RANDOM = new SecureRandom();

    private final SysUserDao userDao;
    private final QaRecordDao qaDao;
    private final ContractDao contractDao;
    private final DocRecordDao docDao;
    private final FavoriteDao favoriteDao;
    private final EmailVerifyCodeDao verifyCodeDao;
    private final MailService mailService;

    /* ---------------- 构造器注入（便于单元测试注入 Mock DAO） ---------------- */

    /** 生产环境使用：装配各 Dao 的 JDBC 实现 */
    public UserServiceImpl() {
        this(new SysUserDaoImpl(), new QaRecordDaoImpl(), new ContractDaoImpl(), new DocRecordDaoImpl(),
                new FavoriteDaoImpl(), new EmailVerifyCodeDaoImpl(), new SmtpMailServiceImpl());
    }

    /**
     * 测试 / 依赖注入使用：由外部传入 Dao 实现，便于用 Mockito 打桩。
     *
     * @param userDao userDao
     * @param qaDao qaDao
     * @param contractDao contractDao
     * @param docDao docDao
     * @param favoriteDao favoriteDao
     * @param verifyCodeDao verifyCodeDao
     * @param mailService mailService
     */
    public UserServiceImpl(SysUserDao userDao, QaRecordDao qaDao, ContractDao contractDao, DocRecordDao docDao,
                           FavoriteDao favoriteDao, EmailVerifyCodeDao verifyCodeDao, MailService mailService) {
        this.userDao = userDao;
        this.qaDao = qaDao;
        this.contractDao = contractDao;
        this.docDao = docDao;
        this.favoriteDao = favoriteDao;
        this.verifyCodeDao = verifyCodeDao;
        this.mailService = mailService;
    }

    @Override
    public SysUser register(String username, String password, String nickname,
                            String email, String phone, String city, String jobTitle) {
        // 旧签名入口：不填邮箱的注册不需要验证码（邮箱验证是可选增强）
        return register(username, password, nickname, email, phone, city, jobTitle, null);
    }

    @Override
    public SysUser register(String username, String password, String nickname,
                            String email, String phone, String city, String jobTitle, String verifyCode) {
        // 1. 参数与格式校验
        if (!StringUtil.isUsername(username)) {
            throw new BizException(ResultCode.PARAM_ERROR, "用户名需为 4~20 位字母开头的字母、数字或下划线");
        }
        checkPassword(password);
        if (StringUtil.isNotEmpty(email) && !StringUtil.isEmail(email)) {
            throw new BizException(ResultCode.PARAM_ERROR, "邮箱格式不正确");
        }
        if (StringUtil.isNotEmpty(phone) && !StringUtil.isPhone(phone)) {
            throw new BizException(ResultCode.PARAM_ERROR, "手机号格式不正确");
        }
        // 2. 唯一性校验
        if (userDao.findByUsername(username) != null) {
            throw new BizException(ResultCode.USERNAME_EXISTS);
        }
        if (StringUtil.isNotEmpty(email) && userDao.findByEmail(email) != null) {
            throw new BizException(ResultCode.EMAIL_EXISTS);
        }
        // 3. 邮箱验证码：填了邮箱就必须先「发送验证码」并回填。
        //    验码刻意放在所有格式 / 唯一性校验之后 —— 用户名写错、密码太弱这类问题
        //    不应该消耗掉一条验证码（60 秒冷却 + 每日上限，码很金贵）。
        //    而消费（markUsed）又放在入库成功之后 —— 注册中途失败时码仍可用，
        //    用户改完直接重提交，不用重新收邮件。
        EmailVerifyCode codeRecord = null;
        if (StringUtil.isNotEmpty(email)) {
            codeRecord = requireValidRegisterCode(StringUtil.trim(email), verifyCode);
        }
        // 4. 加盐哈希
        String salt = PasswordUtil.generateSalt();
        SysUser user = new SysUser();
        user.setUsername(username.trim());
        user.setSalt(salt);
        user.setPassword(PasswordUtil.encrypt(salt, password));
        user.setNickname(StringUtil.defaultIfEmpty(nickname, username));
        user.setEmail(StringUtil.trim(email));
        user.setPhone(StringUtil.trim(phone));
        user.setCity(StringUtil.trim(city));
        user.setJobTitle(StringUtil.trim(jobTitle));
        user.setRole("USER");
        user.setStatus(1);
        LocalDateTime now = DateUtil.now();
        user.setCreatedAt(now);
        user.setUpdatedAt(now);

        Long id = userDao.insert(user);
        user.setId(id);
        if (codeRecord != null) {
            // 注册成功才消费验证码：既防重放，也保证入库失败时码不被白白作废
            verifyCodeDao.markUsed(codeRecord.getId());
        }
        log.info("新用户注册成功: id={}, username={}{}", id, username,
                codeRecord != null ? "（邮箱已验证）" : "");
        return user;
    }

    @Override
    public SysUser login(String username, String password) {
        if (StringUtil.isEmpty(username) || StringUtil.isEmpty(password)) {
            throw new BizException(ResultCode.PARAM_ERROR, "用户名与密码不能为空");
        }
        SysUser user = userDao.findByUsername(username.trim());
        if (user == null && StringUtil.isEmail(username)) {
            // 邮箱注册的用户可以直接用邮箱登录；查不到也走同一句错误提示
            user = userDao.findByEmail(username.trim());
        }
        // 统一提示「用户名或密码错误」，避免暴露账号是否存在
        if (user == null || !PasswordUtil.matches(user.getSalt(), password, user.getPassword())) {
            log.warn("登录失败: username={}", username);
            throw new BizException(ResultCode.LOGIN_FAILED);
        }
        if (user.getStatus() == null || user.getStatus() != 1) {
            throw new BizException(ResultCode.ACCOUNT_DISABLED);
        }
        LocalDateTime now = DateUtil.now();
        userDao.updateLastLogin(user.getId(), now);
        user.setLastLoginAt(now);
        log.info("用户登录成功: id={}, username={}, role={}", user.getId(), user.getUsername(), user.getRole());
        return user;
    }

    @Override
    public SysUser getById(Long id) {
        SysUser user = userDao.findById(id);
        if (user == null) {
            throw new BizException(ResultCode.USER_NOT_FOUND);
        }
        return user;
    }

    @Override
    public SysUser updateProfile(Long id, String nickname, String email, String phone,
                                 String city, String jobTitle, String avatar) {
        SysUser user = getById(id);
        if (StringUtil.isNotEmpty(email) && !StringUtil.isEmail(email)) {
            throw new BizException(ResultCode.PARAM_ERROR, "邮箱格式不正确");
        }
        if (StringUtil.isNotEmpty(phone) && !StringUtil.isPhone(phone)) {
            throw new BizException(ResultCode.PARAM_ERROR, "手机号格式不正确");
        }
        // 邮箱改动时需要去重
        if (StringUtil.isNotEmpty(email) && !email.equals(user.getEmail())) {
            SysUser other = userDao.findByEmail(email);
            if (other != null && !other.getId().equals(id)) {
                throw new BizException(ResultCode.EMAIL_EXISTS);
            }
        }
        user.setNickname(StringUtil.trim(nickname));
        user.setEmail(StringUtil.trim(email));
        user.setPhone(StringUtil.trim(phone));
        user.setCity(StringUtil.trim(city));
        user.setJobTitle(StringUtil.trim(jobTitle));
        if (StringUtil.isNotEmpty(avatar)) {
            user.setAvatar(avatar);
        }
        user.setUpdatedAt(DateUtil.now());
        userDao.update(user);
        return user;
    }

    @Override
    public void changePassword(Long id, String oldPassword, String newPassword) {
        SysUser user = getById(id);
        if (!PasswordUtil.matches(user.getSalt(), oldPassword, user.getPassword())) {
            throw new BizException(ResultCode.OLD_PASSWORD_ERROR);
        }
        checkPassword(newPassword);
        if (oldPassword.equals(newPassword)) {
            throw new BizException(ResultCode.PARAM_ERROR, "新密码不能与原密码相同");
        }
        saveNewPassword(user, newPassword);
        log.info("用户修改密码: id={}", id);
    }

    @Override
    public void resetPassword(Long id, String newPassword) {
        SysUser user = getById(id);
        checkPassword(newPassword);
        saveNewPassword(user, newPassword);
        log.info("管理员重置密码: id={}", id);
    }

    @Override
    public void sendPasswordResetCode(String email, String clientIp) {
        String mail = checkEmail(email);
        if (!mailService.isConfigured()) {
            throw new BizException(ResultCode.MAIL_NOT_CONFIGURED);
        }
        LocalDateTime now = DateUtil.now();
        checkSendQuota(mail, SCENE_RESET, clientIp, now);

        String code = randomCode();
        String salt = PasswordUtil.generateSalt();
        EmailVerifyCode record = new EmailVerifyCode();
        record.setEmail(mail);
        record.setScene(SCENE_RESET);
        record.setSalt(salt);
        record.setCodeHash(PasswordUtil.encrypt(salt, code));
        record.setExpireAt(now.plusMinutes(CODE_TTL_MINUTES));
        record.setUsed(0);
        record.setAttempts(0);
        record.setClientIp(StringUtil.trim(clientIp));
        record.setCreatedAt(now);
        record.setId(verifyCodeDao.insert(record));
        // 发信顺手清一次旧码：这张表只增不删会一直长，而过期的码没有任何留存价值
        verifyCodeDao.purgeBefore(now.minusHours(CODE_RETENTION_HOURS));

        SysUser user = userDao.findByEmail(mail);
        if (user == null || user.getStatus() == null || user.getStatus() != 1) {
            // 邮箱没绑定可用账号：不发信、把这条码作废，但**正常返回** —— 调用方给的是同一句
            // 「验证码已发送」，于是这个匿名接口不会变成一台账号枚举机。
            // 仍要先落库，是为了让邮箱/IP 配额对这种请求同样计数，否则刷不存在的邮箱不受限制。
            verifyCodeDao.markUsed(record.getId());
            log.info("找回密码：邮箱未绑定可用账号，已跳过发信");
            return;
        }

        try {
            mailService.sendPasswordResetCode(mail, code, CODE_TTL_MINUTES);
        } catch (BizException e) {
            // 发信失败就把这条码作废：否则用户在 60 秒冷却期内重试只会看到「发送过于频繁」，
            // 把真正的原因（邮件配置有问题）盖掉了。
            verifyCodeDao.markUsed(record.getId());
            throw e;
        }
        log.info("找回密码验证码已发送: id={}, username={}", user.getId(), user.getUsername());
    }

    @Override
    public void resetPasswordByCode(String email, String code, String newPassword) {
        String mail = checkEmail(email);
        if (StringUtil.isEmpty(code) || !code.trim().matches("\\d{" + CODE_LENGTH + "}")) {
            throw new BizException(ResultCode.VERIFY_CODE_INVALID);
        }
        EmailVerifyCode record = verifyCodeDao.findLatestValid(mail, SCENE_RESET, DateUtil.now());
        if (record == null) {
            throw new BizException(ResultCode.VERIFY_CODE_INVALID);
        }
        if (!PasswordUtil.matches(record.getSalt(), code.trim(), record.getCodeHash())) {
            verifyCodeDao.increaseAttempts(record.getId());
            int attempts = (record.getAttempts() == null ? 0 : record.getAttempts()) + 1;
            if (attempts >= CODE_MAX_ATTEMPTS) {
                verifyCodeDao.markUsed(record.getId());
            }
            log.warn("找回密码验证码校验失败，已累计 {} 次: email={}", attempts, mail);
            throw new BizException(ResultCode.VERIFY_CODE_INVALID);
        }
        SysUser user = userDao.findByEmail(mail);
        if (user == null) {
            throw new BizException(ResultCode.USER_NOT_FOUND);
        }
        if (user.getStatus() == null || user.getStatus() != 1) {
            throw new BizException(ResultCode.ACCOUNT_DISABLED);
        }
        checkPassword(newPassword);
        // 先作废再改密：宁可让用户重新发一次码，也不留一个能重放的验证码
        verifyCodeDao.markUsed(record.getId());
        saveNewPassword(user, newPassword);
        log.info("用户通过邮箱验证码重置密码: id={}, username={}", user.getId(), user.getUsername());
    }

    @Override
    public String sendRegisterCode(String email, String clientIp) {
        String mail = checkEmail(email);
        // ★ 与找回密码的语义相反：注册场景下「邮箱已被注册」要明确报错。
        //   不存在账号枚举问题 —— 注册接口本来就要做邮箱唯一性校验（EMAIL_EXISTS）。
        if (userDao.findByEmail(mail) != null) {
            throw new BizException(ResultCode.EMAIL_EXISTS);
        }
        boolean mailReady = mailService.isConfigured();
        LocalDateTime now = DateUtil.now();
        checkSendQuota(mail, SCENE_REGISTER, clientIp, now);

        String code = randomCode();
        String salt = PasswordUtil.generateSalt();
        EmailVerifyCode record = new EmailVerifyCode();
        record.setEmail(mail);
        record.setScene(SCENE_REGISTER);
        record.setSalt(salt);
        record.setCodeHash(PasswordUtil.encrypt(salt, code));
        record.setExpireAt(now.plusMinutes(CODE_TTL_MINUTES));
        record.setUsed(0);
        record.setAttempts(0);
        record.setClientIp(StringUtil.trim(clientIp));
        record.setCreatedAt(now);
        record.setId(verifyCodeDao.insert(record));
        // 发信顺手清一次旧码（与找回密码同一张表、同一套保留策略）
        verifyCodeDao.purgeBefore(now.minusHours(CODE_RETENTION_HOURS));

        if (!mailReady) {
            // 开发模式：验证码交给调用方直接回填。表里这条记录保证校验链路完整
            // （限流、过期、试错上限都照常生效），演示环境不因 SMTP 没配而走不通注册。
            log.info("注册验证码（开发模式，邮件未启用）: email={}", mail);
            return code;
        }
        try {
            mailService.sendRegisterCode(mail, code, CODE_TTL_MINUTES);
        } catch (BizException e) {
            // 与找回密码同理：发信失败就作废这条码，别让用户在冷却期里只看到「发送频繁」
            verifyCodeDao.markUsed(record.getId());
            throw e;
        }
        log.info("注册验证码已发送: email={}", mail);
        return null;
    }

    /**
     * 校验注册验证码（<b>不消费</b>）。
     *
     * <p>消费由调用方在用户入库成功之后做（{@code markUsed}）—— 这样「用户名已被占用」
     * 这类失败不会浪费验证码，用户改完重提交即可；而一旦注册成功，码立即作废、不可重放。</p>
     *
     * @return 校验通过的验证码记录（含主键，供消费方 markUsed）
     */
    private EmailVerifyCode requireValidRegisterCode(String mail, String code) {
        if (StringUtil.isEmpty(code) || !code.trim().matches("\\d{" + CODE_LENGTH + "}")) {
            throw new BizException(ResultCode.PARAM_ERROR, "请输入 " + CODE_LENGTH + " 位数字邮箱验证码");
        }
        EmailVerifyCode record = verifyCodeDao.findLatestValid(mail, SCENE_REGISTER, DateUtil.now());
        if (record == null) {
            throw new BizException(ResultCode.VERIFY_CODE_INVALID, "验证码无效或已过期，请重新获取");
        }
        if (!PasswordUtil.matches(record.getSalt(), code.trim(), record.getCodeHash())) {
            verifyCodeDao.increaseAttempts(record.getId());
            int attempts = (record.getAttempts() == null ? 0 : record.getAttempts()) + 1;
            if (attempts >= CODE_MAX_ATTEMPTS) {
                verifyCodeDao.markUsed(record.getId());
            }
            log.warn("注册验证码校验失败，已累计 {} 次: email={}", attempts, mail);
            throw new BizException(ResultCode.VERIFY_CODE_INVALID);
        }
        return record;
    }

    @Override
    public PageResult<SysUser> page(String keyword, String role, Integer status, int pageNum, int pageSize) {
        return page(keyword, role, status, pageNum, pageSize, null, null);
    }

    @Override
    public PageResult<SysUser> page(String keyword, String role, Integer status, int pageNum, int pageSize,
                                    String sortName, String sortOrder) {
        pageNum = Math.max(1, pageNum);
        pageSize = pageSize < 1 ? 10 : Math.min(pageSize, 100);
        int offset = (pageNum - 1) * pageSize;
        long total = userDao.countByCondition(keyword, role, status);
        if (total == 0) {
            return PageResult.empty(pageNum, pageSize);
        }
        return PageResult.of(userDao.findByCondition(keyword, role, status, offset, pageSize, sortName, sortOrder), total, pageNum, pageSize);
    }

    @Override
    public void updateStatus(Long id, Integer status, Long operatorId) {
        if (status == null || (status != 0 && status != 1)) {
            throw new BizException(ResultCode.PARAM_ERROR, "状态只能为 0 或 1");
        }
        if (id.equals(operatorId) && status == 0) {
            throw new BizException(ResultCode.OPERATION_NOT_ALLOWED, "不能禁用当前登录账号");
        }
        getById(id);
        userDao.updateStatus(id, status);
        log.info("管理员修改账号状态: id={}, status={}, operator={}", id, status, operatorId);
    }

    @Override
    public void updateRole(Long id, String role, Long operatorId) {
        if (!"USER".equals(role) && !"ADMIN".equals(role)) {
            throw new BizException(ResultCode.PARAM_ERROR, "角色只能为 USER 或 ADMIN");
        }
        if (id.equals(operatorId) && "USER".equals(role)) {
            throw new BizException(ResultCode.OPERATION_NOT_ALLOWED, "不能取消自己的管理员权限");
        }
        SysUser user = getById(id);
        user.setRole(role);
        user.setUpdatedAt(DateUtil.now());
        userDao.update(user);
        log.info("管理员修改角色: id={}, role={}, operator={}", id, role, operatorId);
    }

    @Override
    public void delete(Long id, Long operatorId) {
        if (id.equals(operatorId)) {
            throw new BizException(ResultCode.CANNOT_DELETE_SELF);
        }
        getById(id);
        userDao.deleteById(id);
        log.info("管理员删除用户: id={}, operator={}", id, operatorId);
    }

    @Override
    public Map<String, Object> profileSummary(Long userId) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("qaCount", qaDao.countByUserId(userId));
        map.put("contractCount", contractDao.countByUserId(userId));
        map.put("docCount", docDao.countByUserId(userId));
        map.put("favoriteCount", favoriteDao.countByUser(userId));
        return map;
    }

    // ------------------------------------------------------------------ 私有方法

    /** 校验邮箱格式并规整（去首尾空白），返回可直接用于查库与发信的值 */
    private static String checkEmail(String email) {
        if (!StringUtil.isEmail(email)) {
            throw new BizException(ResultCode.PARAM_ERROR, "邮箱格式不正确");
        }
        return StringUtil.trim(email);
    }

    /**
     * 发码限流，三道闸门依次是：同邮箱冷却 → 同邮箱每日额度 → 同 IP 每日额度。
     *
     * <p>冷却挡单人连点；每日额度挡住对某个真实邮箱的轰炸；IP 额度挡「换邮箱刷」——
     * 少了最后一条，脚本只要每次换个邮箱就能绕过前两条。</p>
     *
     * <p>计数依据是 {@code email_verify_code} 里本条请求之前落库的记录，
     * 因此必须在 insert 之前调用。</p>
     */
    private void checkSendQuota(String mail, String scene, String clientIp, LocalDateTime now) {
        if (verifyCodeDao.countSince(mail, scene, now.minusSeconds(CODE_INTERVAL_SECONDS)) > 0) {
            throw new BizException(ResultCode.VERIFY_CODE_SEND_TOO_FREQUENT,
                    "验证码已发送，请 " + CODE_INTERVAL_SECONDS + " 秒后再试");
        }
        if (verifyCodeDao.countSince(mail, scene, now.minusDays(1)) >= CODE_MAX_PER_EMAIL) {
            throw new BizException(ResultCode.VERIFY_CODE_SEND_TOO_FREQUENT,
                    "该邮箱今日发送次数已达上限，请次日再试或联系管理员");
        }
        if (StringUtil.isNotEmpty(clientIp)
                && verifyCodeDao.countByIpSince(clientIp, scene, now.minusDays(1)) >= CODE_MAX_PER_IP) {
            throw new BizException(ResultCode.VERIFY_CODE_SEND_TOO_FREQUENT,
                    "当前网络今日发送次数已达上限，请次日再试");
        }
    }

    /** 密码强度校验：长度 + 不能为纯数字 / 纯字母 */
    private void checkPassword(String password) {
        if (StringUtil.isEmpty(password) || password.length() < PWD_MIN || password.length() > PWD_MAX) {
            throw new BizException(ResultCode.PARAM_ERROR,
                    "密码长度需在 " + PWD_MIN + "~" + PWD_MAX + " 位之间");
        }
        boolean hasLetter = password.chars().anyMatch(Character::isLetter);
        boolean hasDigit = password.chars().anyMatch(Character::isDigit);
        if (!hasLetter || !hasDigit) {
            throw new BizException(ResultCode.PARAM_ERROR, "密码需同时包含字母和数字");
        }
    }

    /** 换新盐并落库，避免同一密码在库里出现相同摘要 */
    private void saveNewPassword(SysUser user, String newPassword) {
        String salt = PasswordUtil.generateSalt();
        userDao.updatePassword(user.getId(), PasswordUtil.encrypt(salt, newPassword), salt);
    }

    /**
     * 生成 6 位数字验证码。
     *
     * <p>逐位取随机数而非 {@code 100000~999999} 的区间：那样会让首位永不出现 0，
     * 白丢一个数量级的组合空间。这里的码必须走 {@link SecureRandom} ——
     * 用 {@code java.util.Random} 的话，观测到几个码就能推下一次的种子。</p>
     */
    private static String randomCode() {
        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            sb.append(RANDOM.nextInt(10));
        }
        return sb.toString();
    }
}
