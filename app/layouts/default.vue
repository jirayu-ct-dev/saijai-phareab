<script setup lang="ts">
import type { NavigationMenuItem, DropdownMenuItem } from '@nuxt/ui'

const { addLineFriend } = useLiffAuth()
const { logout, user, session, userAvatar } = useUser()
const open = ref(false)

const menu = computed<NavigationMenuItem[]>(() => [
    {
        label: 'ซักอบรีดรายชิ้น',
        href: '/#per-item-pricing',
        active: false
    },
    {
        label: 'สมัครสมาชิกรายเดือน',
        href: '/#monthly-membership',
        active: false
    },
    {
        label: 'คำถามที่พบบ่อย',
        href: '/#faq',
        active: false
    },
    {
        label: 'ติดต่อเรา',
        href: '/#contact',
        active: false
    }
])

const itemsDropdown = computed<DropdownMenuItem[][]>(() => {
    const roleLinks: DropdownMenuItem[] = []

    if (user.value?.role === 'ADMIN') {
        roleLinks.push({
            label: 'หน้าหลักผู้ดูแลระบบ',
            icon: 'i-lucide-shield',
            to: '/admin'
        })
    } else if (user.value?.role === 'EMPLOYEE') {
        roleLinks.push({
            label: 'หน้าหลักพนักงาน',
            icon: 'i-lucide-briefcase',
            to: '/admin/employee-dashboard'
        })
    } else {
        roleLinks.push({
            label: 'หน้าหลักสมาชิก',
            icon: 'i-lucide-layout-dashboard',
            to: '/me'
        })
    }

    return [
        [
            {
                label: user.value?.name || 'ผู้ใช้งาน',
                avatar: userAvatar.value,
                type: 'label'
            }
        ],
        [
            {
                label: 'Profile',
                icon: 'i-lucide-user',
                to: '/me'
            },
            {
                label: 'Settings',
                icon: 'i-lucide-cog',
                to: '/settings'
            }
        ],
        roleLinks,
        [
            {
                label: 'Logout',
                icon: 'i-lucide-log-out',
                color: 'error',
                class: 'cursor-pointer',
                onClick: () => {
                    logout();
                }
            }
        ]
    ]
})

</script>

<template>
    <UHeader v-model:open="open" mode="slideover">

        <template #toggle>
            <UButton
                color="neutral"
                variant="ghost"
                :icon="open ? 'i-lucide-x' : 'i-lucide-menu'"
                :aria-label="open ? 'ปิดเมนู' : 'เปิดเมนู'"
                class="lg:hidden -me-1.5 touch-manipulation cursor-pointer"
                @pointerup.prevent="open = !open"
            />
        </template>

        <UNavigationMenu :items="menu" />

        <!-- Logo & Brand -->
        <template #left>
            <AppLogo label="LAUNDRY SERVICE" to="/" />
        </template>

        <!-- Right Side Actions -->
        <template #right>
            <div v-show="!open" class="hidden md:flex items-center  gap-1.5">


                <UIButtonAddFriendLine :addLineFriend="addLineFriend" />
                <UColorModeSwitch />
                <div v-if="!session" class="hidden md:inline-flex">
                    <UButton color="neutral" variant="ghost" class="p-2" to="/auth/login" label="ลงชื่อเข้าใช้" />
                    <UButton color="primary" variant="solid" class="p-2" to="/auth/register" label="สมัครสมาชิก" />
                </div>

                <div v-if="session" class="flex gap-3 items-center px-4">
                    <UDropdownMenu :items="itemsDropdown">
                        <div class="cursor-pointer flex items-center gap-1">
                            <UAvatar v-bind="userAvatar" />
                            <UIcon name="i-lucide-chevron-down" class="size-4 text-muted" />
                        </div>
                    </UDropdownMenu>
                </div>
            </div>
        </template>

        <!-- Mobile Menu Body -->
        <template #body>
            <UNavigationMenu :items="menu" orientation="vertical" class="-mx-2.5" />
            <USeparator class="my-4" />
            <UIButtonAddFriendLine :addLineFriend="addLineFriend" class="w-full" />
            <div class="flex items-center justify-between mt-4">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">เปลี่ยนธีม</span>
                <UColorModeSwitch />
            </div>
            <div v-if="!session" class="mt-4 flex flex-col gap-2">
                <UButton block color="neutral" variant="outline" to="/auth/login" label="ลงชื่อเข้าใช้" />
                <UButton block color="primary" variant="solid" to="/auth/register" label="สมัครสมาชิก" />
            </div>

            <template v-if="session">
                <USeparator class="my-4" />
                <UUser :name="user?.name || 'ผู้ใช้งาน'" :avatar="userAvatar" class="mb-4" />

                <div class="flex flex-col gap-1">
                    <template v-for="(group, groupIndex) in itemsDropdown.slice(1)" :key="groupIndex">
                        <template v-for="(item) in group" :key="item.label">
                            <UButton :to="item.to" :icon="item.icon" :color="item.color || 'neutral'" variant="ghost"
                                class="w-full justify-start" @click="item.onClick ? item.onClick() : null">
                                {{ item.label }}
                            </UButton>
                        </template>
                        <USeparator v-if="groupIndex < itemsDropdown.length - 2" class="my-2" />
                    </template>
                </div>
            </template>
        </template>
    </UHeader>
    <UMain>
        <div class="container mx-auto max-w-7xl px-10 lg:px-12">
            <slot />
        </div>
    </UMain>

    <UFooter>
        <template #top>
            <div class="container mx-auto max-w-7xl px-10 lg:px-12 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24">
                <div class="flex flex-col gap-6">
                    <div>
                        <div class="flex items-center gap-2">
                            <img src="/logo-saijai-phareab.png" class="h-15" alt="SaiJai-Phareab" />
                            <div>
                                <p class="font-semibold"><span class="text-primary">ใส่ใจ </span>ผ้าเรียบ</p>
                                <p class="text-[0.7rem] font-medium text-gray-500 tracking-widest dark:text-gray-300">
                                    LAUNDRY
                                    SERVICE</p>
                            </div>
                        </div>
                        <p class="text-sm text-muted mt-4">
                            บริการซักอบรีดครบวงจร ด้วยเทคโนโลยีที่ทันสมัยและผลิตภัณฑ์คุณภาพสูง
                            เพื่อให้เสื้อผ้าของคุณสะอาด ปลอดภัย และหอมสดชื่น
                        </p>
                    </div>

                    <div>
                        <h3 class="font-semibold text-sm mb-4">ติดตามเรา</h3>
                        <div class="flex gap-2">
                            <UButton color="neutral" variant="ghost" size="sm" to="https://www.facebook.com/saijaiburiram/?rdid=amPWW1eNJg7Yb6OB" aria-label="Facebook"
                                class="text-[#4267B2]">
                                <UIcon name="i-simple-icons-facebook" class="size-5" />
                            </UButton>
                            <!-- <UButton color="neutral" variant="ghost" size="sm" to="#" aria-label="Instagram"
                                class="text-[#E1306C]">
                                <UIcon name="i-simple-icons-instagram" class="size-5" />
                            </UButton> -->
                            <UButton color="neutral" variant="ghost" size="sm" to="https://line.me/R/ti/p/@883vmdct" aria-label="LINE"
                                class="text-[#06C755]">
                                <UIcon name="i-simple-icons-line" class="size-5" />
                            </UButton>
                        </div>
                    </div>
                </div>

                <!-- ด้านขวา: บริการ กับ ข้อมูลติดต่อ -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div>
                        <h3 class="font-semibold text-sm mb-4">บริการของเรา</h3>
                        <ul class="space-y-4 text-sm">
                            <li><a href="#per-item-pricing"
                                    class="hover:text-primary transition-colors">ซักอบรีดรายชิ้น</a>
                            </li>
                            <li><a href="#monthly-membership"
                                    class="hover:text-primary transition-colors">สมัครสมาชิกรายเดือน</a>
                            </li>
                            <li><a href="#faq" class="hover:text-primary transition-colors">คำถามที่พบบ่อย</a></li>
                            <li><a href="#contact" class="hover:text-primary transition-colors">ติดต่อเรา</a></li>
                        </ul>
                    </div>

                    <div>
                        <h3 class="font-semibold text-sm mb-4">ข้อมูลติดต่อ</h3>
                        <ul class="space-y-4 text-sm">
                            <li class="flex items-start gap-3">
                                <UIcon name="i-lucide-phone" class="size-4 shrink-0 mt-0.5 text-muted" />
                                <span>086-022-2196</span>
                            </li>
                            <li class="flex items-start gap-3">
                                <UIcon name="i-lucide-mail" class="size-4 shrink-0 mt-0.5 text-muted" />
                                <span>[EMAIL_ADDRESS]</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </template>

        <template #bottom>
            <div class="flex flex-col md:flex-row items-center justify-between gap-4 container mx-auto max-w-7xl px-10 lg:px-12">
                <p class="text-sm text-muted">
                    &copy; {{ new Date().getFullYear() }} SaiJai-Phareab. All rights reserved.
                </p>
            </div>
        </template>
    </UFooter>
</template>
