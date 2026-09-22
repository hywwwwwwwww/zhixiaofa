package com.zhixiaofa.service.impl;

import com.zhixiaofa.common.PageResult;
import com.zhixiaofa.common.ResultCode;
import com.zhixiaofa.dao.ContractDao;
import com.zhixiaofa.dao.DocRecordDao;
import com.zhixiaofa.dao.FavoriteDao;
import com.zhixiaofa.dao.QaRecordDao;
import com.zhixiaofa.dao.SysUserDao;
import com.zhixiaofa.dao.impl.ContractDaoImpl;
import com.zhixiaofa.dao.impl.DocRecordDaoImpl;
import com.zhixiaofa.dao.impl.FavoriteDaoImpl;
import com.zhixiaofa.dao.impl.QaRecordDaoImpl;
import com.zhixiaofa.dao.impl.SysUserDaoImpl;
import com.zhixiaofa.exception.BizException;
import com.zhixiaofa.model.SysUser;
import com.zhixiaofa.service.UserService;
import com.zhixiaofa.util.DateUtil;
import com.zhixiaofa.util.PasswordUtil;
import com.zhixiaofa.util.StringUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

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

    private final SysUserDao userDao;
    private final QaRecordDao qaDao;
    private final ContractDao contractDao;
    private final DocRecordDao docDao;
    private final FavoriteDao favoriteDao;

    /* ---------------- 构造器注入（便于单元测试注入 Mock DAO） ---------------- */

    /** 生产环境使用：装配各 Dao 的 JDBC 实现 */
    public UserServiceImpl() {
        this(new SysUserDaoImpl(), new QaRecordDaoImpl(), new ContractDaoImpl(), new DocRecordDaoImpl(), new FavoriteDaoImpl());
    }

    /**
     * 测试 / 依赖注入使用：由外部传入 Dao 实现，便于用 Mockito 打桩。
     *
     * @param userDao userDao
     * @param qaDao qaDao
     * @param contractDao contractDao
     * @param docDao docDao
     * @param favoriteDao favoriteDao
     */
    public UserServiceImpl(SysUserDao userDao, QaRecordDao qaDao, ContractDao contractDao, DocRecordDao docDao, FavoriteDao favoriteDao) {
        this.userDao = userDao;
        this.qaDao = qaDao;
        this.contractDao = contractDao;
        this.docDao = docDao;
        this.favoriteDao = favoriteDao;
    }

    @Override
    public SysUser register(String username, String password, String nickname,
                            String email, String phone, String city, String jobTitle) {
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
        // 3. 加盐哈希
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
        log.info("新用户注册成功: id={}, username={}", id, username);
        return user;
    }

    @Override
    public SysUser login(String username, String password) {
        if (StringUtil.isEmpty(username) || StringUtil.isEmpty(password)) {
            throw new BizException(ResultCode.PARAM_ERROR, "用户名与密码不能为空");
        }
        SysUser user = userDao.findByUsername(username.trim());
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
    public PageResult<SysUser> page(String keyword, String role, Integer status, int pageNum, int pageSize) {
        pageNum = Math.max(1, pageNum);
        pageSize = pageSize < 1 ? 10 : Math.min(pageSize, 100);
        int offset = (pageNum - 1) * pageSize;
        long total = userDao.countByCondition(keyword, role, status);
        if (total == 0) {
            return PageResult.empty(pageNum, pageSize);
        }
        return PageResult.of(userDao.findByCondition(keyword, role, status, offset, pageSize), total, pageNum, pageSize);
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
}
