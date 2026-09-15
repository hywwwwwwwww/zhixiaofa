package com.zhixiaofa.common;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

/**
 * 分页结果封装（课程要求：数据分页查询）。
 *
 * @param <T> 列表元素类型
 * @author 职小法小组
 * @version 1.0
 */
public class PageResult<T> implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 当前页数据 */
    private List<T> list = new ArrayList<>();
    /** 总记录数 */
    private long total;
    /** 当前页码，从 1 开始 */
    private int pageNum = 1;
    /** 每页条数 */
    private int pageSize = 10;
    /** 总页数 */
    private int pages;

    public PageResult() {
    }

    public PageResult(List<T> list, long total, int pageNum, int pageSize) {
        this.list = list == null ? new ArrayList<>() : list;
        this.total = total;
        this.pageNum = pageNum;
        this.pageSize = pageSize;
        this.pages = pageSize > 0 ? (int) ((total + pageSize - 1) / pageSize) : 0;
    }

    public static <T> PageResult<T> of(List<T> list, long total, int pageNum, int pageSize) {
        return new PageResult<>(list, total, pageNum, pageSize);
    }

    public static <T> PageResult<T> empty(int pageNum, int pageSize) {
        return new PageResult<>(new ArrayList<>(), 0, pageNum, pageSize);
    }

    /** @return 是否存在下一页，前端按钮状态用 */
    public boolean isHasNext() {
        return pageNum < pages;
    }

    public List<T> getList() {
        return list;
    }

    public void setList(List<T> list) {
        this.list = list;
    }

    public long getTotal() {
        return total;
    }

    public void setTotal(long total) {
        this.total = total;
    }

    public int getPageNum() {
        return pageNum;
    }

    public void setPageNum(int pageNum) {
        this.pageNum = pageNum;
    }

    public int getPageSize() {
        return pageSize;
    }

    public void setPageSize(int pageSize) {
        this.pageSize = pageSize;
    }

    public int getPages() {
        return pages;
    }

    public void setPages(int pages) {
        this.pages = pages;
    }

    @Override
    public String toString() {
        return "PageResult{total=" + total + ", pageNum=" + pageNum + ", pageSize=" + pageSize
                + ", pages=" + pages + ", listSize=" + (list == null ? 0 : list.size()) + '}';
    }
}
