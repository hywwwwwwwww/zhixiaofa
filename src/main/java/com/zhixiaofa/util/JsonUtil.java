package com.zhixiaofa.util;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.zhixiaofa.exception.BizException;
import com.zhixiaofa.common.ResultCode;

import java.util.Map;

/**
 * JSON 工具类：基于 Jackson 封装 Java 对象与 JSON 的序列化 / 反序列化。
 *
 * <p>统一配置：</p>
 * <ul>
 *   <li>支持 Java 8 时间类型（LocalDateTime / LocalDate）；</li>
 *   <li>遇到未知字段不抛异常（前端多传字段不至于 500）；</li>
 *   <li>时间统一格式化为 {@code yyyy-MM-dd HH:mm:ss}，方便前端直接展示。</li>
 * </ul>
 *
 * @author 职小法小组
 * @version 1.0
 */
public final class JsonUtil {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    static {
        JavaTimeModule timeModule = new JavaTimeModule();
        timeModule.addSerializer(java.time.LocalDateTime.class,
                new com.fasterxml.jackson.datatype.jsr310.ser.LocalDateTimeSerializer(
                        java.time.format.DateTimeFormatter.ofPattern(DateUtil.DATETIME_PATTERN)));
        timeModule.addSerializer(java.time.LocalDate.class,
                new com.fasterxml.jackson.datatype.jsr310.ser.LocalDateSerializer(
                        java.time.format.DateTimeFormatter.ofPattern(DateUtil.DATE_PATTERN)));
        MAPPER.registerModule(timeModule);
        MAPPER.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        MAPPER.disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
        MAPPER.setSerializationInclusion(com.fasterxml.jackson.annotation.JsonInclude.Include.ALWAYS);
    }

    private JsonUtil() {
    }

    public static ObjectMapper mapper() {
        return MAPPER;
    }

    /** 对象 → JSON 字符串 */
    public static String toJson(Object obj) {
        if (obj == null) {
            return "null";
        }
        try {
            return MAPPER.writeValueAsString(obj);
        } catch (Exception e) {
            throw new BizException(ResultCode.JSON_ERROR, "对象序列化失败: " + e.getMessage());
        }
    }

    /** JSON 字符串 → 对象 */
    public static <T> T parse(String json, Class<T> clazz) {
        if (json == null || json.trim().isEmpty()) {
            return null;
        }
        try {
            return MAPPER.readValue(json, clazz);
        } catch (Exception e) {
            throw new BizException(ResultCode.JSON_ERROR, "JSON 解析失败: " + e.getMessage());
        }
    }

    /** JSON 字符串 → 泛型对象（如 Map / List） */
    public static <T> T parse(String json, TypeReference<T> type) {
        if (json == null || json.trim().isEmpty()) {
            return null;
        }
        try {
            return MAPPER.readValue(json, type);
        } catch (Exception e) {
            throw new BizException(ResultCode.JSON_ERROR, "JSON 解析失败: " + e.getMessage());
        }
    }

    /** JSON 字符串 → Map&lt;String,Object&gt; */
    public static Map<String, Object> parseMap(String json) {
        return parse(json, new TypeReference<Map<String, Object>>() {
        });
    }
}
