# Guide

- [Tạo GitHub Page cá nhân](https://github.com/ngodanghai9x/learn-os-deployments/blob/main/.github/author-profile/github-page-guide.md) — quy trình chung: tạo repo `<username>.github.io`, chọn cách làm trang, viết nội dung, deploy, gắn vào CV.
- [GitHub Pages deployment](https://github.com/ngodanghai9x/learn-os-deployments/blob/main/.github/author-profile/github-pages-deployment.md) — User Pages vs Project Pages, gắn custom domain, redirect `*.github.io` → custom domain, caveat SPA/static build.
- [Tạo GitLab Page cá nhân](https://github.com/ngodanghai9x/learn-os-deployments/blob/main/.github/author-profile/gitlab-page-guide.md) — quy trình chung tương ứng cho GitLab: tạo project `<username>.gitlab.io`, chọn cách làm trang, viết nội dung, deploy, gắn vào CV.
- [GitLab Pages deployment](https://github.com/ngodanghai9x/learn-os-deployments/blob/main/.github/author-profile/gitlab-pages-deployment.md) — cách build & publish site này (Jekyll + gem `github-pages`) lên GitLab Pages qua `.gitlab-ci.yml`, gắn custom domain, khác biệt so với GitHub Pages.
- [Tự host GitLab Runner](https://github.com/ngodanghai9x/learn-os-deployments/blob/main/docker-composes/gitlab-runner/gitlab-runner-guide.md) — bypass lỗi pipeline fail do account chưa verify identity: cần tắt hẳn shared runner cho project (không chỉ thêm tag), và trigger pipeline mới thay vì Retry.
