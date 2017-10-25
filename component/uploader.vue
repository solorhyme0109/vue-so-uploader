<template>
  <div id="uploader">
    <input id="file-select" type="file" multiple @change="handleChange($event)" style="display:none">
    <label for="file-select" style="float:left">选择要上传的文件</label>
    <button type="button" name="button" @click="upload()" style="float:right">{{!uploading ? '上传' : '停止'}}</button>
    <!-- <hr> -->
    <ul style="clear:both">
      <li v-for="f of fileList">
        <div class="subli name">{{f.name}}</div>
        <div class="subli status">{{f.status | state}}</div>
        <div class="subli size">{{f.size | normailzeBytes}}</div>
        <div class="subli proc">{{f.uploadedSize | percentage(f.size)}}</div>
        <div class="subli procline"><span class="procinline" :style="{width: (f.uploadedSize/f.size * 100) + '%'}"></span></div>
        <div class="" style="clear:both">

        </div>
      </li>
    </ul>
    <div class="speed" style="float:right">
      上传速度: {{speed | normailzeBytes}}/s
    </div>
  </div>
</template>
<script>
import { ArrayBuffer as SparkArrayBuffer } from 'spark-md5'

const __log = function () { // eslint-disable-line no-underscore-dangle,func-names
  // console.log(...arguments)
  console && console.log && console.log(...arguments)
}

const UPLOAD_STATUS_READY = 0
const UPLOAD_STATUS_UPLOADING = 1
const UPLOAD_STATUS_COMPLETED = 2
const UPLOAD_STATUS_PAUSED = 3

export default {
  name: 'uploader',
  props: {
    action: {
      type: String,
      default () {
        return '/upload/divided'
      }
    },
    limit: {
      type: Number,
      default () {
        return 409600
      }
    }
  },
  data () {
    return {
      fileList: [],
      uploading: false,
      terminal: false,
      speed: 0
    }
  },
  methods: {
    handleChange (e) {
      const { files } = e.target
      // eslint-disable-next-line
      for (const f of files) {
        f.status = 0
        this.fileList.push({
          name: f.name,
          type: f.type,
          size: f.size,
          uploadedSize: 0,
          status: UPLOAD_STATUS_READY,
          file: f
        })
      }
    },
    async hashFile (file) {
      const reader = new FileReader()
      reader.readAsArrayBuffer(file)
      const readerResult = await new Promise((resolve) => {
        reader.onloadend = () => {
          resolve(reader.result)
        }
      })
      const spark = new SparkArrayBuffer()
      spark.append(readerResult)
      const hash = spark.end()
      return hash
    },
    async beforeUpload (fileDescr) {
      const hash = await this.hashFile(fileDescr.file)
      const res = await this.$http.get(this.action, {
        params: {
          hash
        }
      })
      const fileInfo = res.data
      let uploadedSize = 0
      if (fileInfo.size && fileDescr.size <= fileInfo.size) {
        // file already exist, remove file
        await this.$http.delete(this.action, {
          params: { hash }
        })
      } else {
        // part file uploaded
        uploadedSize = fileInfo.size || 0
      }
      fileDescr.uploadedSize = uploadedSize
      return { hash, uploadedSize }
    },
    async upload () {
      if (this.uploading) {
        this.terminal = true
        return
      }
      const files = this.fileList.filter(f => f.status !== UPLOAD_STATUS_COMPLETED)
      const { limit } = this
      const ctx = this
      this.uploading = true
      await uploadFiles(files, 0)
      this.uploading = false
      this.terminal = false
      this.speed = 0
      async function uploadFiles (files, i) { // eslint-disable-line no-shadow
        if (ctx.terminal) return undefined// paused and stop upload files
        if (i < files.length) {
          const { hash, uploadedSize } = await ctx.beforeUpload(files[i])
          files[i].status = UPLOAD_STATUS_UPLOADING // uploading
          // slice
          const chunks = Math.ceil(files[i].size / limit)
          let start = 0
          if (uploadedSize) {
            start = uploadedSize / limit
          }
          const suc = await uploadFile(hash, files[i], start, chunks, ctx)
          if (suc) {
            i += 1
            return uploadFiles(files, i)
          }
          __log('upload failed')
          return false
        }
        __log('all file uploaded')
        return true
      }
      async function uploadFile (hash, fileDescr, start, chunks, ctx) { // eslint-disable-line no-shadow
        if (ctx.terminal) { // paused and stop upload file
          fileDescr.status = UPLOAD_STATUS_PAUSED
          return true
        }
        const chunk = fileDescr.file.slice(start * limit, start * limit + limit)
        const formData = new FormData()
        formData.append('chunk', chunk)
        formData.append('hash', hash)
        formData.append('size', fileDescr.size)
        const time0 = Date.now()
        await ctx.$http.post(ctx.action, formData)
        const time1 = Date.now()
        ctx.speed = chunk.size / ((time1 - time0) / 1000)
        fileDescr.uploadedSize += chunk.size
        start += 1
        if (start < chunks) {
          return uploadFile(hash, fileDescr, start, chunks, ctx)
        }
        fileDescr.status = UPLOAD_STATUS_COMPLETED
        return true
      }
    }
  },
  filters: {
    state (v) {
      const map = {
        [UPLOAD_STATUS_READY]: '准备上传',
        [UPLOAD_STATUS_UPLOADING]: '正在上传',
        [UPLOAD_STATUS_COMPLETED]: '上传成功',
        [UPLOAD_STATUS_PAUSED]: '暂停中'
      }
      return map[v]
    },
    percentage (v, m) {
      return `${Math.round((Number(v) / Number(m)) * 100)}%`
    },
    normailzeBytes (v) {
      const unit = ['bytes', 'KB', 'MB', 'GB']
      let i = 0
      while (v / 1000 > 1 && i < unit.length) { // 1024 or 1000 ?
        v /= 1000
        i += 1
      }
      return `${v.toFixed(2)} ${unit[i]}`
    }
  }
}
</script>
<style lang="less" scoped>
  #uploader {
    position: relative;
    min-height: 3rem;
    font-size: 14px;
    border: 2px solid #a4c0e8;
    padding: .2rem;
    border-radius: .1rem;
    label, button {
      display: inline-block;
      background: #5d8fd8;
      color: #fff;
      padding: .1rem;
      border: none;
      border-radius: .05rem;
      outline: none;
    }
    ul {
      padding: 0;
      margin: .6rem 0;
    }
    li {
      list-style: none;
      border-top: 1px solid #eee;
      // border-bottom: 1px solid #eee;
      &:last-child {
        border-bottom: 1px solid #eee;
      }
      padding: .1rem 0;
      .subli {
        margin: .04rem 0;
      }
      .name {
        float: left;
      }
      .size {
        padding-top: .1rem;
        padding-bottom: .1rem;
        clear: both;
        font-size: 60%;
        color: #999;
      }
      .status {
        float: right;
        font-size: 60%;
      }
      .proc {
        float: left;
        font-size: 60%;
        color: #42b983;
      }
      .procline {
        float: right;
        width: 100%;
        height: 2px;
        border: 1px solid #42b983;
        border-radius: 2px;
        span {
          display: block;
          // width: 83%;
          height: 100%;
          background: #42b983;
        }
      }
    }
    .speed {
      position: absolute;
      right: .15rem;
      bottom: .15rem;
      font-size: 60%;
      margin: auto;
      width: 40%;
      text-align: right;
      // float: right;
    }
  }
</style>
