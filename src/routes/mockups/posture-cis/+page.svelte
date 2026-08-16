<script lang="ts">
	// ── Mockup: Posture · CIS Kubernetes Benchmark ────────────────────────────
	//
	// Visualizes ONE scan of `armornet posture --framework=cis` (tool/kubebench).
	// Destined to be a new tab on console/extensions — same density, same card/
	// row/chip language as that page, single-column results view.
	//
	// Honest-scope guardrails (from docs/development/posture-ui-brief.md):
	//   - Single-scan snapshot + one "last scan" time. No trend charts, no
	//     historical deltas — we don't collect that data.
	//   - Node-scoped privileged tool; no per-workload / per-namespace dimension.
	//   - Framework picker shows only CIS (the only real framework today); the
	//     SegmentGroup shape is how more would slot in later.
	//
	// The row hierarchy is the argument: FAIL and WARN are the money content, so
	// they sort first and PASS rows collapse behind a per-target toggle.
	// Remediation is the payoff of a drill-in — reading a failure should make
	// the fix obvious, so it renders as a copyable terminal block plus
	// expected-vs-actual.
	//
	// API stubs:
	//   GET  /api/orgs/:id/posture/latest?framework=cis  → ScanResult
	//   POST /api/orgs/:id/posture/scan { framework }    → { requested: true }
	//
	// Data shapes (exact fields from the Go tool):
	//   ScanResult   { benchmark, detected_version, targets: TargetResult[], totals: Summary }
	//   TargetResult { target, checks: CheckResult[], summary: Summary }
	//   CheckResult  { id, text, state: PASS|FAIL|WARN|INFO, scored, remediation,
	//                  actual_value, expected_result, reason }
	//   Summary      { pass, fail, warn, info }
	import {
		LayoutHeader,
		Panel,
		Collapsible,
		Button,
		Chip,
		SegmentGroup,
		SearchInput,
		EmptyState,
		TerminalBlock,
		StackedBar,
		Icon
	} from '$lib/index.js';

	type CheckState = 'PASS' | 'FAIL' | 'WARN' | 'INFO';
	interface CheckResult {
		id: string;
		text: string;
		state: CheckState;
		scored: boolean;
		remediation?: string;
		actual_value?: string;
		expected_result?: string;
		reason?: string;
	}
	interface Summary {
		pass: number;
		fail: number;
		warn: number;
		info: number;
	}
	interface TargetResult {
		target: string;
		checks: CheckResult[];
		summary: Summary;
	}

	// ── Sample scan (real dev-cluster shape: cis-1.11 on k8s 1.30) ───────────
	// Check ids/texts read like real kube-bench output; the formulaic 1.1.x and
	// 5.x families are generated the way kube-bench itself is formulaic.

	const c = (
		id: string,
		text: string,
		state: CheckState,
		scored = true,
		extra: Partial<CheckResult> = {}
	): CheckResult => ({ id, text, state, scored, ...extra });

	// 1.1.x — control-plane file permissions/ownership (formulaic pairs).
	const masterFiles: [string, string][] = [
		['kube-apiserver pod specification file', '/etc/kubernetes/manifests/kube-apiserver.yaml'],
		[
			'kube-controller-manager pod specification file',
			'/etc/kubernetes/manifests/kube-controller-manager.yaml'
		],
		['kube-scheduler pod specification file', '/etc/kubernetes/manifests/kube-scheduler.yaml'],
		['etcd pod specification file', '/etc/kubernetes/manifests/etcd.yaml']
	];
	const oneOne: CheckResult[] = masterFiles.flatMap(([what, path], i) => [
		c(
			`1.1.${i * 2 + 1}`,
			`Ensure that the ${what} permissions are set to 600 or more restrictive`,
			'PASS',
			true,
			{ actual_value: `permissions=600 ${path}`, expected_result: `permissions has value 600` }
		),
		c(`1.1.${i * 2 + 2}`, `Ensure that the ${what} ownership is set to root:root`, 'PASS', true, {
			actual_value: `root:root ${path}`,
			expected_result: `'root:root' is equal to 'root:root'`
		})
	]);
	oneOne.push(
		c(
			'1.1.9',
			'Ensure that the Container Network Interface file permissions are set to 600 or more restrictive',
			'WARN',
			false,
			{
				reason: 'Manual check — CNI file locations vary by plugin.',
				remediation: 'Run the below command (based on the file location on your system) on the control plane node.\nchmod 600 <path/to/cni/files>'
			}
		),
		c(
			'1.1.10',
			'Ensure that the Container Network Interface file ownership is set to root:root',
			'WARN',
			false,
			{
				reason: 'Manual check — CNI file locations vary by plugin.',
				remediation: 'Run the below command (based on the file location on your system) on the control plane node.\nchown root:root <path/to/cni/files>'
			}
		),
		c('1.1.11', 'Ensure that the etcd data directory permissions are set to 700 or more restrictive', 'PASS', true, {
			actual_value: 'permissions=700 /var/lib/etcd',
			expected_result: 'permissions has value 700'
		}),
		c('1.1.12', 'Ensure that the etcd data directory ownership is set to etcd:etcd', 'FAIL', true, {
			actual_value: 'root:root /var/lib/etcd',
			expected_result: "'etcd:etcd' is present",
			remediation:
				'On the etcd server node, get the etcd data directory, passed as an argument --data-dir,\nfrom the command "ps -ef | grep etcd".\nRun the below command (based on the etcd data directory found above).\nFor example, chown etcd:etcd /var/lib/etcd'
		}),
		c('1.1.13', 'Ensure that the default administrative credential file permissions are set to 600', 'PASS'),
		c('1.1.14', 'Ensure that the default administrative credential file ownership is set to root:root', 'PASS'),
		c('1.1.15', 'Ensure that the scheduler.conf file permissions are set to 600 or more restrictive', 'PASS'),
		c('1.1.16', 'Ensure that the scheduler.conf file ownership is set to root:root', 'PASS'),
		c('1.1.17', 'Ensure that the controller-manager.conf file permissions are set to 600 or more restrictive', 'PASS'),
		c('1.1.18', 'Ensure that the controller-manager.conf file ownership is set to root:root', 'PASS'),
		c('1.1.19', 'Ensure that the Kubernetes PKI directory and file ownership is set to root:root', 'PASS'),
		c(
			'1.1.20',
			'Ensure that the Kubernetes PKI certificate file permissions are set to 600 or more restrictive',
			'WARN',
			false,
			{
				reason: 'Manual check — some distributions ship 644 certificates.',
				remediation: 'Run the below command (based on the file location on your system) on the control plane node.\nchmod -R 600 /etc/kubernetes/pki/*.crt'
			}
		),
		c('1.1.21', 'Ensure that the Kubernetes PKI key file permissions are set to 600', 'WARN', false, {
			reason: 'Manual check.',
			remediation: 'Run the below command (based on the file location on your system) on the control plane node.\nchmod -R 600 /etc/kubernetes/pki/*.key'
		})
	);

	// 1.2.x — API server flags.
	const oneTwo: CheckResult[] = [
		c('1.2.1', 'Ensure that the --anonymous-auth argument is set to false', 'PASS', true, {
			expected_result: "'--anonymous-auth' is equal to 'false'"
		}),
		c('1.2.2', 'Ensure that the --token-auth-file parameter is not set', 'PASS'),
		c('1.2.3', 'Ensure that the DenyServiceExternalIPs admission controller is set', 'PASS'),
		c('1.2.4', 'Ensure that the --kubelet-client-certificate and --kubelet-client-key arguments are set as appropriate', 'PASS'),
		c('1.2.5', 'Ensure that the --kubelet-certificate-authority argument is set as appropriate', 'FAIL', true, {
			actual_value: '--kubelet-certificate-authority is not set',
			expected_result: "'--kubelet-certificate-authority' is present",
			remediation:
				'Follow the Kubernetes documentation and setup the TLS connection between\nthe apiserver and kubelets. Then, edit the API server pod specification file\n/etc/kubernetes/manifests/kube-apiserver.yaml on the control plane node and set the\n--kubelet-certificate-authority parameter to the path to the cert file for the certificate authority.\n--kubelet-certificate-authority=<ca-string>'
		}),
		c('1.2.6', 'Ensure that the --authorization-mode argument is not set to AlwaysAllow', 'WARN', false, {
			reason: 'Manual verification of the full authorization chain is recommended.'
		}),
		c('1.2.7', 'Ensure that the --authorization-mode argument includes Node', 'PASS'),
		c('1.2.8', 'Ensure that the --authorization-mode argument includes RBAC', 'PASS'),
		c('1.2.9', 'Ensure that the admission control plugin EventRateLimit is set', 'WARN', false, {
			reason: 'Manual — requires an admission control config file tuned to your cluster.',
			remediation:
				'Follow the Kubernetes documentation and set the desired limits in a configuration file.\nThen, edit the API server pod specification file /etc/kubernetes/manifests/kube-apiserver.yaml\nand set the below parameters.\n--enable-admission-plugins=...,EventRateLimit,...\n--admission-control-config-file=<path/to/configuration/file>'
		}),
		c('1.2.10', 'Ensure that the admission control plugin AlwaysAdmit is not set', 'PASS'),
		c('1.2.11', 'Ensure that the admission control plugin AlwaysPullImages is set', 'WARN', false, {
			reason: 'Manual — enabling it can break offline/air-gapped image pulls.',
			remediation:
				'Edit the API server pod specification file /etc/kubernetes/manifests/kube-apiserver.yaml\non the control plane node and set the --enable-admission-plugins parameter to include AlwaysPullImages.\n--enable-admission-plugins=...,AlwaysPullImages,...'
		}),
		c('1.2.12', 'Ensure that the admission control plugin ServiceAccount is set', 'WARN', false, {
			reason: 'Manual check.'
		}),
		c('1.2.13', 'Ensure that the admission control plugin NamespaceLifecycle is set', 'PASS'),
		c('1.2.14', 'Ensure that the admission control plugin NodeRestriction is set', 'PASS'),
		c('1.2.15', 'Ensure that the --profiling argument is set to false', 'FAIL', true, {
			actual_value: '--profiling is not set (defaults to true)',
			expected_result: "'--profiling' is equal to 'false'",
			remediation:
				'Edit the API server pod specification file /etc/kubernetes/manifests/kube-apiserver.yaml\non the control plane node and set the below parameter.\n--profiling=false'
		}),
		c('1.2.16', 'Ensure that the --audit-log-path argument is set', 'FAIL', true, {
			actual_value: '--audit-log-path is not set',
			expected_result: "'--audit-log-path' is present",
			remediation:
				'Edit the API server pod specification file /etc/kubernetes/manifests/kube-apiserver.yaml\non the control plane node and set the --audit-log-path parameter to a suitable path and\nfile where you would like audit logs to be written, for example,\n--audit-log-path=/var/log/apiserver/audit.log'
		}),
		c('1.2.17', 'Ensure that the --audit-log-maxage argument is set to 30 or as appropriate', 'FAIL', true, {
			actual_value: '--audit-log-maxage is not set',
			expected_result: "'--audit-log-maxage' is greater or equal to 30",
			remediation:
				'Edit the API server pod specification file /etc/kubernetes/manifests/kube-apiserver.yaml\non the control plane node and set the --audit-log-maxage parameter to 30\nor as an appropriate number of days, for example,\n--audit-log-maxage=30'
		}),
		c('1.2.18', 'Ensure that the --audit-log-maxbackup argument is set to 10 or as appropriate', 'FAIL', true, {
			actual_value: '--audit-log-maxbackup is not set',
			expected_result: "'--audit-log-maxbackup' is greater or equal to 10",
			remediation:
				'Edit the API server pod specification file /etc/kubernetes/manifests/kube-apiserver.yaml\non the control plane node and set the --audit-log-maxbackup parameter to 10 or to an appropriate\nvalue, for example,\n--audit-log-maxbackup=10'
		}),
		c('1.2.19', 'Ensure that the --audit-log-maxsize argument is set to 100 or as appropriate', 'FAIL', true, {
			actual_value: '--audit-log-maxsize is not set',
			expected_result: "'--audit-log-maxsize' is greater or equal to 100",
			remediation:
				'Edit the API server pod specification file /etc/kubernetes/manifests/kube-apiserver.yaml\non the control plane node and set the --audit-log-maxsize parameter to an appropriate size in MB,\nfor example,\n--audit-log-maxsize=100'
		}),
		c('1.2.20', 'Ensure that the --request-timeout argument is set as appropriate', 'PASS'),
		c('1.2.21', 'Ensure that the --service-account-lookup argument is set to true', 'PASS'),
		c('1.2.22', 'Ensure that the --service-account-key-file argument is set as appropriate', 'PASS'),
		c('1.2.23', 'Ensure that the --etcd-certfile and --etcd-keyfile arguments are set as appropriate', 'PASS'),
		c('1.2.24', 'Ensure that the --tls-cert-file and --tls-private-key-file arguments are set as appropriate', 'PASS'),
		c('1.2.25', 'Ensure that the --client-ca-file argument is set as appropriate', 'PASS'),
		c('1.2.26', 'Ensure that the --etcd-cafile argument is set as appropriate', 'PASS'),
		c('1.2.27', 'Ensure that the --tls-cipher-suites argument is set as appropriate', 'PASS'),
		c('1.2.28', 'Ensure that the API Server only makes use of Strong Cryptographic Ciphers', 'PASS'),
		c('1.2.29', 'Ensure that encryption providers are appropriately configured', 'WARN', false, {
			reason: 'Manual — verify aescbc/kms provider choice matches your threat model.'
		}),
		c('1.2.30', 'Ensure that the --encryption-provider-config argument is set as appropriate', 'FAIL', true, {
			actual_value: '--encryption-provider-config is not set',
			expected_result: "'--encryption-provider-config' is present",
			remediation:
				'Follow the Kubernetes documentation and configure a EncryptionConfig file.\nThen, edit the API server pod specification file /etc/kubernetes/manifests/kube-apiserver.yaml\non the control plane node and set the --encryption-provider-config parameter to the path of that file.\n--encryption-provider-config=</path/to/EncryptionConfig/File>'
		})
	];

	// 1.3.x controller manager · 1.4.x scheduler.
	const oneThreeFour: CheckResult[] = [
		c('1.3.1', 'Ensure that the --terminated-pod-gc-threshold argument is set as appropriate', 'PASS'),
		c('1.3.2', 'Ensure that the --profiling argument is set to false', 'FAIL', true, {
			actual_value: '--profiling is not set (defaults to true)',
			expected_result: "'--profiling' is equal to 'false'",
			remediation:
				'Edit the Controller Manager pod specification file\n/etc/kubernetes/manifests/kube-controller-manager.yaml on the control plane node\nand set the below parameter.\n--profiling=false'
		}),
		c('1.3.3', 'Ensure that the --use-service-account-credentials argument is set to true', 'PASS'),
		c('1.3.4', 'Ensure that the --service-account-private-key-file argument is set as appropriate', 'PASS'),
		c('1.3.5', 'Ensure that the --root-ca-file argument is set as appropriate', 'PASS'),
		c('1.3.6', 'Ensure that the RotateKubeletServerCertificate argument is set to true', 'WARN', false, {
			reason: 'Manual — not applicable when kubelet server certs come from an external CA.'
		}),
		c('1.3.7', 'Ensure that the --bind-address argument is set to 127.0.0.1', 'WARN', false, {
			reason: 'Manual — scrape endpoints may require a non-loopback bind.'
		}),
		c('1.4.1', 'Ensure that the --profiling argument is set to false', 'FAIL', true, {
			actual_value: '--profiling is not set (defaults to true)',
			expected_result: "'--profiling' is equal to 'false'",
			remediation:
				'Edit the Scheduler pod specification file /etc/kubernetes/manifests/kube-scheduler.yaml file\non the control plane node and set the below parameter.\n--profiling=false'
		}),
		c('1.4.2', 'Ensure that the --bind-address argument is set to 127.0.0.1', 'PASS')
	];

	const etcdChecks: CheckResult[] = [
		c('2.1', 'Ensure that the --cert-file and --key-file arguments are set as appropriate', 'PASS'),
		c('2.2', 'Ensure that the --client-cert-auth argument is set to true', 'PASS'),
		c('2.3', 'Ensure that the --auto-tls argument is not set to true', 'PASS'),
		c('2.4', 'Ensure that the --peer-cert-file and --peer-key-file arguments are set as appropriate', 'PASS'),
		c('2.5', 'Ensure that the --peer-client-cert-auth argument is set to true', 'PASS'),
		c('2.6', 'Ensure that the --peer-auto-tls argument is not set to true', 'PASS'),
		c('2.7', 'Ensure that a unique Certificate Authority is used for etcd', 'PASS')
	];

	const controlplaneChecks: CheckResult[] = [
		c('3.1.1', 'Client certificate authentication should not be used for users', 'WARN', false, {
			reason: 'Manual — audit how users authenticate; prefer OIDC over client certs.'
		}),
		c('3.1.2', 'Service account token authentication should not be used for users', 'WARN', false, {
			reason: 'Manual.'
		}),
		c('3.1.3', 'Bootstrap token authentication should not be used for users', 'WARN', false, {
			reason: 'Manual.'
		}),
		c('3.2.1', 'Ensure that a minimal audit policy is created', 'WARN', false, {
			reason: 'Manual — no audit policy file detected.',
			remediation: 'Create an audit policy file for your cluster.'
		}),
		c('3.2.2', 'Ensure that the audit policy covers key security concerns', 'WARN', false, {
			reason: 'Manual — review the audit policy for secrets, pod exec and RBAC coverage.'
		})
	];

	const nodeChecks: CheckResult[] = [
		c('4.1.1', 'Ensure that the kubelet service file permissions are set to 600 or more restrictive', 'FAIL', true, {
			actual_value: 'permissions=644 /etc/systemd/system/kubelet.service.d/10-kubeadm.conf',
			expected_result: 'permissions has permissions 600, expected 600 or more restrictive',
			remediation:
				'Run the below command (based on the file location on your system) on the each worker node.\nFor example, chmod 600 /etc/systemd/system/kubelet.service.d/10-kubeadm.conf'
		}),
		c('4.1.2', 'Ensure that the kubelet service file ownership is set to root:root', 'PASS'),
		c('4.1.3', 'If proxy kubeconfig file exists ensure permissions are set to 600 or more restrictive', 'WARN', false, {
			reason: 'Manual — kube-proxy runs as a DaemonSet; no host kubeconfig found.'
		}),
		c('4.1.4', 'If proxy kubeconfig file exists ensure ownership is set to root:root', 'PASS'),
		c('4.1.5', 'Ensure that the --kubeconfig kubelet.conf file permissions are set to 600 or more restrictive', 'PASS'),
		c('4.1.6', 'Ensure that the --kubeconfig kubelet.conf file ownership is set to root:root', 'PASS'),
		c('4.1.7', 'Ensure that the certificate authorities file permissions are set to 600 or more restrictive', 'PASS'),
		c('4.1.8', 'Ensure that the client certificate authorities file ownership is set to root:root', 'PASS'),
		c('4.1.9', 'If the kubelet config.yaml configuration file is being used validate permissions set to 600 or more restrictive', 'FAIL', true, {
			actual_value: 'permissions=644 /var/lib/kubelet/config.yaml',
			expected_result: 'permissions has permissions 600, expected 600 or more restrictive',
			remediation:
				'Run the following command (using the config file location identified in the Audit step)\nchmod 600 /var/lib/kubelet/config.yaml'
		}),
		c('4.1.10', 'If the kubelet config.yaml configuration file is being used validate file ownership is set to root:root', 'PASS'),
		c('4.2.1', 'Ensure that the --anonymous-auth argument is set to false', 'PASS', true, {
			expected_result: "'--anonymous-auth' is equal to 'false'"
		}),
		c('4.2.2', 'Ensure that the --authorization-mode argument is not set to AlwaysAllow', 'PASS'),
		c('4.2.3', 'Ensure that the --client-ca-file argument is set as appropriate', 'PASS'),
		c('4.2.4', 'Verify that the --read-only-port argument is set to 0', 'PASS'),
		c('4.2.5', 'Ensure that the --streaming-connection-idle-timeout argument is not set to 0', 'PASS'),
		c('4.2.6', 'Ensure that the --make-iptables-util-chains argument is set to true', 'PASS'),
		c('4.2.7', 'Ensure that the --hostname-override argument is not set', 'PASS'),
		c('4.2.8', 'Ensure that the eventRecordQPS argument is set to a level which ensures appropriate event capture', 'WARN', false, {
			reason: 'Manual — tune to your logging pipeline.'
		}),
		c('4.2.9', 'Ensure that the --tls-cert-file and --tls-private-key-file arguments are set as appropriate', 'WARN', false, {
			reason: 'Manual — kubelet serving certs are self-signed on this cluster.'
		}),
		c('4.2.10', 'Ensure that the --rotate-certificates argument is not set to false', 'PASS'),
		c('4.2.11', 'Verify that the RotateKubeletServerCertificate argument is set to true', 'PASS'),
		c('4.2.12', 'Ensure that the kubelet only makes use of Strong Cryptographic Ciphers', 'WARN', false, {
			reason: 'Manual — verify tlsCipherSuites in the kubelet config.'
		}),
		c('4.2.13', 'Ensure that a limit is set on pod PIDs', 'WARN', false, {
			reason: 'Manual — set podPidsLimit appropriate to your workloads.'
		}),
		c('4.3.1', 'Ensure that the kube-proxy metrics service is bound to localhost', 'PASS'),
		c('4.3.2', 'Ensure that the kube-proxy config file permissions are set to 600 or more restrictive', 'WARN', false, {
			reason: 'Manual.'
		}),
		c('4.3.3', 'Ensure that the kube-proxy config file ownership is set to root:root', 'WARN', false, {
			reason: 'Manual.'
		})
	];

	// 5.x — policies. All manual (WARN) in kube-bench: they need a human to
	// audit RBAC/PSS/NetworkPolicy intent, not a flag on disk.
	const policyTexts: [string, string][] = [
		['5.1.1', 'Ensure that the cluster-admin role is only used where required'],
		['5.1.2', 'Minimize access to secrets'],
		['5.1.3', 'Minimize wildcard use in Roles and ClusterRoles'],
		['5.1.4', 'Minimize access to create pods'],
		['5.1.5', 'Ensure that default service accounts are not actively used'],
		['5.1.6', 'Ensure that Service Account Tokens are only mounted where necessary'],
		['5.1.7', 'Avoid use of system:masters group'],
		['5.1.8', 'Limit use of the Bind, Impersonate and Escalate permissions in the Kubernetes cluster'],
		['5.1.9', 'Minimize access to create persistent volumes'],
		['5.1.10', 'Minimize access to the proxy sub-resource of nodes'],
		['5.1.11', 'Minimize access to the approval sub-resource of certificatesigningrequests objects'],
		['5.1.12', 'Minimize access to webhook configuration objects'],
		['5.1.13', 'Minimize access to the service account token creation'],
		['5.2.1', 'Ensure that the cluster has at least one active policy control mechanism in place'],
		['5.2.2', 'Minimize the admission of privileged containers'],
		['5.2.3', 'Minimize the admission of containers wishing to share the host process ID namespace'],
		['5.2.4', 'Minimize the admission of containers wishing to share the host IPC namespace'],
		['5.2.5', 'Minimize the admission of containers wishing to share the host network namespace'],
		['5.2.6', 'Minimize the admission of containers with allowPrivilegeEscalation'],
		['5.2.7', 'Minimize the admission of root containers'],
		['5.2.8', 'Minimize the admission of containers with the NET_RAW capability'],
		['5.2.9', 'Minimize the admission of containers with added capabilities'],
		['5.2.10', 'Minimize the admission of containers with capabilities assigned'],
		['5.2.11', 'Minimize the admission of Windows HostProcess Containers'],
		['5.2.12', 'Minimize the admission of HostPath volumes'],
		['5.2.13', 'Minimize the admission of containers which use HostPorts'],
		['5.3.1', 'Ensure that the CNI in use supports NetworkPolicies'],
		['5.3.2', 'Ensure that all Namespaces have NetworkPolicies defined'],
		['5.4.1', 'Prefer using secrets as files over secrets as environment variables'],
		['5.4.2', 'Consider external secret storage'],
		['5.5.1', 'Configure Image Provenance using ImagePolicyWebhook admission controller'],
		['5.7.1', 'Create administrative boundaries between resources using namespaces'],
		['5.7.2', 'Ensure that the seccomp profile is set to docker/default in your pod definitions'],
		['5.7.3', 'Apply SecurityContext to your Pods and Containers'],
		['5.7.4', 'The default namespace should not be used']
	];
	const policyChecks: CheckResult[] = policyTexts.map(([id, text]) =>
		c(id, text, 'WARN', false, { reason: 'Manual — requires a policy/RBAC audit, not a host flag.' })
	);

	const summarize = (checks: CheckResult[]): Summary => ({
		pass: checks.filter((x) => x.state === 'PASS').length,
		fail: checks.filter((x) => x.state === 'FAIL').length,
		warn: checks.filter((x) => x.state === 'WARN').length,
		info: checks.filter((x) => x.state === 'INFO').length
	});

	const mkTarget = (target: string, checks: CheckResult[]): TargetResult => ({
		target,
		checks,
		summary: summarize(checks)
	});

	const scan = {
		benchmark: 'cis-1.11',
		detected_version: '1.30',
		targets: [
			mkTarget('master', [...oneOne, ...oneTwo, ...oneThreeFour]),
			mkTarget('etcd', etcdChecks),
			mkTarget('controlplane', controlplaneChecks),
			mkTarget('node', nodeChecks),
			mkTarget('policies', policyChecks)
		],
		totals: summarize([
			...oneOne,
			...oneTwo,
			...oneThreeFour,
			...etcdChecks,
			...controlplaneChecks,
			...nodeChecks,
			...policyChecks
		])
	};

	const lastScan = '2026-07-16 06:00 UTC · scheduled (daily)';

	const TARGET_LABEL: Record<string, string> = {
		master: 'Control plane node',
		etcd: 'etcd',
		controlplane: 'Control plane config',
		node: 'Worker nodes',
		policies: 'Policies',
		managedservices: 'Managed services'
	};

	// ── UI state ──────────────────────────────────────────────────────────────
	let framework = $state('cis');
	let stateFilter = $state('all'); // all | fail | warn | pass
	let targetFilter = $state('all');
	let query = $state('');
	let rescanning = $state(false);
	// Per-target "show passing checks" toggle — PASS rows are the quiet
	// majority; FAIL/WARN are what you came to read.
	let showPass = $state<Record<string, boolean>>({});

	const rescan = () => {
		rescanning = true;
		setTimeout(() => (rescanning = false), 1800);
	};

	const STATE_ORDER: Record<CheckState, number> = { FAIL: 0, WARN: 1, INFO: 2, PASS: 3 };
	const cmpId = (a: string, b: string) =>
		a.split('.').map(Number).reduce((r, n, i) => r || n - (b.split('.').map(Number)[i] ?? 0), 0);

	const matches = (ck: CheckResult) => {
		if (stateFilter !== 'all' && ck.state.toLowerCase() !== stateFilter) return false;
		if (query.trim()) {
			const q = query.toLowerCase();
			return ck.id.includes(q) || ck.text.toLowerCase().includes(q);
		}
		return true;
	};

	const visibleTargets = $derived(
		scan.targets
			.filter((t) => targetFilter === 'all' || t.target === targetFilter)
			.map((t) => {
				const hits = t.checks.filter(matches);
				const attention = hits
					.filter((ck) => ck.state !== 'PASS')
					.sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || cmpId(a.id, b.id));
				const passing = hits
					.filter((ck) => ck.state === 'PASS')
					.sort((a, b) => cmpId(a.id, b.id));
				return { ...t, attention, passing, hitCount: hits.length };
			})
			.filter((t) => t.hitCount > 0)
	);

	const shownChecks = $derived(visibleTargets.reduce((n, t) => n + t.hitCount, 0));
	const totalChecks = $derived(
		scan.totals.pass + scan.totals.fail + scan.totals.warn + scan.totals.info
	);
	const filtered = $derived(
		stateFilter !== 'all' || targetFilter !== 'all' || query.trim() !== ''
	);

	const stateChipColor = (s: CheckState) =>
		s === 'FAIL' ? 'error' : s === 'WARN' ? 'warn' : s === 'PASS' ? 'success' : 'blue';
</script>

<LayoutHeader eyebrow="// posture" sub="posture · kube-bench · host agent">
	{#snippet icon()}<Icon name="shield-check" size={16} />{/snippet}
	{#snippet title()}Security posture{/snippet}
	{#snippet meta()}
		<span class="dot on"></span>
		<span class="strong">{scan.benchmark}</span> · k8s
		<span class="strong">{scan.detected_version}</span> · last scan {lastScan}
	{/snippet}
	{#snippet lede()}
		One benchmark run against the cluster's nodes: what passed, what failed, and how to fix each
		failure. Warn items are manual audits the benchmark can't decide from the host alone.
	{/snippet}
	{#snippet eyebrowActions()}
		<Button variant="ghost" size="sm" disabled={rescanning} onclick={rescan}>
			{rescanning ? 'Scanning nodes…' : 'Re-scan now'}
		</Button>
	{/snippet}
</LayoutHeader>

<div class="page">
	<!-- ── Overview roll-up ─────────────────────────────────────────────────── -->
	<Panel tone={scan.totals.fail > 0 ? 'changed' : 'accent'} flush title="This scan">
		{#snippet icon()}<Icon name="clipboard-check" size={14} />{/snippet}
		{#snippet actions()}
			<span class="count">{totalChecks} checks · {scan.targets.length} targets</span>
		{/snippet}

		<div class="overview">
			<div class="tally">
				<div class="tally-item">
					<b class="pass-fg">{scan.totals.pass}</b><span>pass</span>
				</div>
				<div class="tally-item">
					<b class="fail-fg">{scan.totals.fail}</b><span>fail</span>
				</div>
				<div class="tally-item">
					<b class="warn-fg">{scan.totals.warn}</b><span>warn · manual</span>
				</div>
			</div>

			<StackedBar
				size="md"
				showLegend={false}
				segments={[
					{ label: 'pass', value: scan.totals.pass, variant: 'success' },
					{ label: 'fail', value: scan.totals.fail, variant: 'error' },
					{ label: 'warn', value: scan.totals.warn, variant: 'warn' }
				]}
			/>

			<div class="bench">
				<div class="bench-row">
					<span class="bench-k">Framework</span>
					<SegmentGroup
						options={[{ value: 'cis', label: 'CIS Kubernetes' }]}
						value={framework}
						onchange={(v) => (framework = v)}
					/>
				</div>
				<div class="bench-row">
					<span class="bench-k">Benchmark</span>
					<span class="bench-v">
						<Chip color="accent">{scan.benchmark}</Chip>
						<span class="bench-note">auto-detected from k8s {scan.detected_version}</span>
					</span>
				</div>
			</div>

			<!-- Per-target roll-up: each cell filters the list below. -->
			<div class="targets">
				{#each scan.targets as t (t.target)}
					<button
						type="button"
						class="target-cell"
						class:active={targetFilter === t.target}
						onclick={() => (targetFilter = targetFilter === t.target ? 'all' : t.target)}
					>
						<span class="target-name">{t.target}</span>
						<span class="target-nums">
							<span class="pass-fg">{t.summary.pass}</span>
							<span class="sep">/</span>
							<span class="fail-fg">{t.summary.fail}</span>
							<span class="sep">/</span>
							<span class="warn-fg">{t.summary.warn}</span>
						</span>
					</button>
				{/each}
			</div>
		</div>
	</Panel>

	<!-- ── Filters ──────────────────────────────────────────────────────────── -->
	<div class="filters">
		<SegmentGroup
			options={[
				{ value: 'all', label: 'All states' },
				{ value: 'fail', label: `Fail · ${scan.totals.fail}` },
				{ value: 'warn', label: `Warn · ${scan.totals.warn}` },
				{ value: 'pass', label: `Pass · ${scan.totals.pass}` }
			]}
			value={stateFilter}
			onchange={(v) => (stateFilter = v)}
		/>
		<SegmentGroup
			options={[
				{ value: 'all', label: 'All targets' },
				...scan.targets.map((t) => ({ value: t.target, label: t.target }))
			]}
			value={targetFilter}
			onchange={(v) => (targetFilter = v)}
		/>
		<div class="search">
			<SearchInput bind:value={query} placeholder="Filter by check id or text…" />
		</div>
	</div>
	{#if filtered}
		<p class="filter-note">
			<Icon name="filter" size={11} />
			{shownChecks} of {totalChecks} checks shown
			<button type="button" class="clear" onclick={() => { stateFilter = 'all'; targetFilter = 'all'; query = ''; }}>
				clear
			</button>
		</p>
	{/if}

	<!-- ── Per-target results ───────────────────────────────────────────────── -->
	{#if visibleTargets.length === 0}
		<EmptyState variant="card" message="No checks match that filter." />
	{/if}

	{#each visibleTargets as t (t.target)}
		<Panel flush title={TARGET_LABEL[t.target] ?? t.target}>
			{#snippet icon()}<Icon
					name={t.target === 'policies' ? 'file-text' : t.target === 'etcd' ? 'layers' : 'cpu'}
					size={14}
				/>{/snippet}
			{#snippet actions()}
				<span class="target-chips">
					{#if t.summary.fail > 0}<Chip color="error">{t.summary.fail} fail</Chip>{/if}
					{#if t.summary.warn > 0}<Chip color="warn">{t.summary.warn} warn</Chip>{/if}
					<Chip color="success">{t.summary.pass} pass</Chip>
				</span>
			{/snippet}

			{#if t.attention.length === 0 && t.passing.length > 0 && stateFilter === 'all'}
				<p class="allclear">
					<Icon name="check-circle" size={12} />
					All {t.summary.pass} scored checks pass on this target.
				</p>
			{/if}

			<div class="rows">
				{#each t.attention as ck (ck.id)}
					<Collapsible>
						{#snippet trigger({ open, toggle })}
							<button type="button" class="row" onclick={toggle}>
								<span class="verdict {ck.state.toLowerCase()}" aria-hidden="true"></span>
								<span class="row-id">{ck.id}</span>
								<span class="row-text">{ck.text}</span>
								{#if !ck.scored}<span class="row-scored">not scored</span>{/if}
								<Chip color={stateChipColor(ck.state)}>{ck.state}</Chip>
								<Icon name={open ? 'chevron-down' : 'chevron-right'} size={12} />
							</button>
						{/snippet}

						<div class="expand">
							{#if ck.reason}
								<div class="kv">
									<span class="kv-k">Why warn</span>
									<span class="kv-v">{ck.reason}</span>
								</div>
							{/if}
							{#if ck.expected_result}
								<div class="kv">
									<span class="kv-k">Expected</span>
									<code class="kv-code">{ck.expected_result}</code>
								</div>
							{/if}
							{#if ck.actual_value}
								<div class="kv">
									<span class="kv-k">Actual</span>
									<code class="kv-code kv-bad">{ck.actual_value}</code>
								</div>
							{/if}
							{#if ck.remediation}
								<span class="sub-label">
									<Icon name="wrench" size={10} /> Remediation
								</span>
								<TerminalBlock content={ck.remediation} chrome={false} dense />
							{:else if !ck.reason}
								<p class="no-detail">No further detail reported for this check.</p>
							{/if}
						</div>
					</Collapsible>
				{/each}

				{#if t.passing.length > 0 && (t.attention.length > 0 || stateFilter === 'pass' || filtered)}
					{#if stateFilter !== 'pass'}
						<button
							type="button"
							class="pass-toggle"
							onclick={() => (showPass = { ...showPass, [t.target]: !showPass[t.target] })}
						>
							<Icon name={showPass[t.target] ? 'chevron-down' : 'chevron-right'} size={11} />
							{showPass[t.target] ? 'Hide' : 'Show'}
							{t.passing.length} passing check{t.passing.length === 1 ? '' : 's'}
						</button>
					{/if}
					{#if showPass[t.target] || stateFilter === 'pass'}
						{#each t.passing as ck (ck.id)}
							<div class="row row-pass">
								<span class="verdict pass" aria-hidden="true"></span>
								<span class="row-id">{ck.id}</span>
								<span class="row-text">{ck.text}</span>
								<Chip color="success">PASS</Chip>
							</div>
						{/each}
					{/if}
				{/if}
			</div>
		</Panel>
	{/each}
</div>

<style>
	/* Page layout + row content only — card/chip/segment visuals belong to
	   Panel / Chip / SegmentGroup. Mirrors the extensions page's stylesheet
	   discipline so this can port over as a sibling tab. */
	.page {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		margin-top: 0.4rem;
	}

	/* ── Header meta ── */
	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--fg-dim);
		flex-shrink: 0;
	}
	.dot.on {
		background: var(--palette-emerald);
	}
	.strong {
		color: var(--fg);
	}
	.count {
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.04em;
		color: var(--accent);
		white-space: nowrap;
	}

	/* ── Overview ── */
	.overview {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}
	.tally {
		display: flex;
		gap: 1.4rem;
	}
	.tally-item {
		display: flex;
		flex-direction: column;
	}
	.tally-item b {
		font-family: var(--mono);
		font-size: 2rem;
		line-height: 1;
		font-weight: 400;
		font-variant-numeric: tabular-nums;
	}
	.tally-item span {
		font-family: var(--mono);
		font-size: 0.6rem;
		color: var(--fg-dim);
		margin-top: 0.25rem;
	}
	.fail-fg {
		color: var(--palette-red);
	}
	.warn-fg {
		color: var(--palette-amber);
	}
	.pass-fg {
		color: var(--palette-emerald);
	}

	.bench {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.bench-row {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}
	.bench-k {
		font-family: var(--mono);
		font-size: 0.5625rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--fg-dim);
		min-width: 80px;
	}
	.bench-v {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.bench-note {
		font-family: var(--mono);
		font-size: 0.62rem;
		color: var(--fg-dim);
	}

	.targets {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.target-cell {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.45rem 0.65rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg);
		cursor: pointer;
		text-align: left;
	}
	.target-cell:hover {
		border-color: var(--border-strong);
	}
	.target-cell.active {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 6%, transparent);
	}
	.target-name {
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--fg);
	}
	.target-nums {
		font-family: var(--mono);
		font-size: 0.62rem;
		font-variant-numeric: tabular-nums;
	}
	.sep {
		color: var(--fg-dim);
		padding: 0 1px;
	}

	/* ── Filters ── */
	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
	}
	.search {
		flex: 1;
		min-width: 220px;
	}
	.filter-note {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin: -0.3rem 0 0;
		font-family: var(--mono);
		font-size: 0.62rem;
		color: var(--fg-dim);
	}
	.clear {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		font-family: var(--mono);
		font-size: 0.62rem;
		color: var(--accent);
		text-decoration: underline;
	}

	/* ── Rows ── */
	.target-chips {
		display: flex;
		gap: 0.3rem;
	}
	.allclear {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin: 0.4rem 0 0;
		font-size: 0.72rem;
		color: var(--palette-emerald);
	}
	.rows {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin-top: 0.7rem;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		padding: 0.5rem 0.7rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg);
		text-align: left;
		cursor: pointer;
	}
	.row-pass {
		cursor: default;
		opacity: 0.75;
	}
	.row:hover {
		border-color: var(--border-strong);
	}
	.verdict {
		width: 3px;
		align-self: stretch;
		min-height: 20px;
		border-radius: 2px;
		flex-shrink: 0;
	}
	.verdict.fail {
		background: var(--palette-red);
	}
	.verdict.warn {
		background: var(--palette-amber);
	}
	.verdict.pass {
		background: var(--palette-emerald);
	}
	.verdict.info {
		background: var(--palette-blue-l, #38bdf8);
	}
	.row-id {
		font-family: var(--mono);
		font-size: 0.68rem;
		font-variant-numeric: tabular-nums;
		color: var(--fg);
		min-width: 52px;
		flex-shrink: 0;
	}
	.row-text {
		flex: 1;
		min-width: 0;
		font-size: 0.74rem;
		color: var(--fg-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.row-scored {
		font-family: var(--mono);
		font-size: 0.55rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-dim);
		white-space: nowrap;
		flex-shrink: 0;
	}
	.pass-toggle {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem 0.7rem;
		border: 1px dashed var(--border);
		border-radius: 6px;
		background: transparent;
		cursor: pointer;
		font-family: var(--mono);
		font-size: 0.62rem;
		color: var(--fg-dim);
		text-align: left;
	}
	.pass-toggle:hover {
		border-color: var(--border-strong);
		color: var(--fg-muted);
	}

	/* ── Drill-in ── */
	.expand {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		padding: 0.6rem 0.7rem 0.7rem 1.4rem;
	}
	.kv {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
	}
	.kv-k {
		font-family: var(--mono);
		font-size: 0.5625rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--fg-dim);
		min-width: 70px;
		flex-shrink: 0;
	}
	.kv-v {
		font-size: 0.72rem;
		line-height: 1.5;
		color: var(--fg-muted);
	}
	.kv-code {
		font-family: var(--mono);
		font-size: 0.65rem;
		color: var(--palette-emerald);
		word-break: break-all;
	}
	.kv-bad {
		color: var(--palette-red);
	}
	.sub-label {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		margin-top: 0.15rem;
		font-family: var(--mono);
		font-size: 0.5625rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.no-detail {
		margin: 0;
		font-size: 0.7rem;
		font-style: italic;
		color: var(--fg-dim);
	}
</style>
